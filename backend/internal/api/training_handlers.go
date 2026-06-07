package api

import (
	"database/sql"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type trainingPlanPayload struct {
	Title     string                `json:"title"`
	Published bool                  `json:"published"`
	Chapters  []trainingChapterBody `json:"chapters"`
}

type trainingChapterBody struct {
	Title         string           `json:"title"`
	OrderNo       int              `json:"orderNo"`
	ProblemIDs    []int64          `json:"problemIds"`
	ProblemDrafts []problemPayload `json:"problemDrafts"`
}

type participantPayload struct {
	UserID int64 `json:"userId"`
}

func (a *API) handleListTrainingPlans(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	if err := a.ensureSpaceReadable(spaceID, user.ID, user.GlobalRole); err != nil {
		return err
	}
	canManage, err := a.isSpaceAdmin(spaceID, user.ID, user.GlobalRole)
	if err != nil {
		return err
	}

	query := `
	SELECT
	  tp.id,
	  tp.title,
	  tp.published_at,
	  tp.created_at,
		  (SELECT GROUP_CONCAT(u.username, ", ") FROM training_participants tp2 JOIN users u ON u.id=tp2.user_id WHERE tp2.plan_id=tp.id) AS participant_usernames,
	  EXISTS(
	    SELECT 1
	    FROM training_participants p
	    WHERE p.plan_id=tp.id AND p.user_id=?
	  ) AS joined
	FROM training_plans tp
	WHERE tp.space_id=?
	ORDER BY tp.id DESC`
	args := []interface{}{user.ID, spaceID}
	if !canManage {
			query = `
		SELECT
		  tp.id,
		  tp.title,
		  tp.published_at,
		  tp.created_at,
		  (SELECT GROUP_CONCAT(u.username, ", ") FROM training_participants tp2 JOIN users u ON u.id=tp2.user_id WHERE tp2.plan_id=tp.id) AS participant_usernames,
		  EXISTS(
		    SELECT 1
		    FROM training_participants p
		    WHERE p.plan_id=tp.id AND p.user_id=?
		  ) AS joined
		FROM training_plans tp
		WHERE tp.space_id=?
		  AND tp.published_at IS NOT NULL
		  AND EXISTS(
		    SELECT 1
		    FROM training_participants p
		    WHERE p.plan_id=tp.id AND p.user_id=?
		  )
		ORDER BY tp.id DESC`
		args = []interface{}{user.ID, spaceID, user.ID}
	}

	rows, err := a.DB.Query(query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	plans := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var title string
		var joined int
		var participantUsernames, publishedAt, createdAt sql.NullString
		if err := rows.Scan(&id, &title, &publishedAt, &createdAt, &participantUsernames, &joined); err != nil {
			return err
		}
		plans = append(plans, fiber.Map{
			"id":          id,
			"title":       title,
			"joined":      joined == 1,
			"participantUsernames": scanNullString(participantUsernames),
			"published":   publishedAt.Valid,
			"publishedAt": scanNullString(publishedAt),
			"createdAt":   scanNullString(createdAt),
		})
	}
	return respondData(c, plans)
}

func (a *API) handleCreateTrainingPlan(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	user, err := getUser(c)
	if err != nil {
		return err
	}
	var req trainingPlanPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return respondError(c, fiber.StatusBadRequest, "title required")
	}

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	publishedAt := sql.NullString{}
	if req.Published {
		publishedAt = sql.NullString{Valid: true, String: time.Now().UTC().Format(time.RFC3339)}
	}
	res, err := tx.Exec(`
	INSERT INTO training_plans(space_id, title, published_at)
	VALUES(?, ?, ?)`, spaceID, req.Title, nullToInterface(publishedAt))
	if err != nil {
		return err
	}
	planID, _ := res.LastInsertId()
	if err := upsertTrainingChapters(tx, planID, spaceID, user.ID, req.Chapters); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": planID})
}

func (a *API) handleGetTrainingPlan(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	planID, err := parseIDParam(c, "planId")
	if err != nil {
		return err
	}
	if err := a.ensureSpaceReadable(spaceID, user.ID, user.GlobalRole); err != nil {
		return err
	}
	access, err := a.loadTrainingPlanAccess(spaceID, planID, user.ID, user.GlobalRole)
	if err != nil {
		return err
	}

	viewUserID := user.ID
	if viewAsParam := c.Query("viewAs"); viewAsParam != "" {
		canManage, mgrErr := a.isSpaceAdmin(spaceID, user.ID, user.GlobalRole)
		if mgrErr == nil && canManage {
			if vid, parseErr := strconv.ParseInt(viewAsParam, 10, 64); parseErr == nil && vid > 0 {
				viewUserID = vid
			}
		}
	}
	chapters, err := a.loadPlanChapters(planID, spaceID, viewUserID)
	if err != nil {
		return err
	}
	participants, err := a.loadPlanParticipants(planID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{
		"id":           planID,
		"spaceId":      spaceID,
		"title":        access.Title,
		"published":    access.PublishedAt.Valid,
		"publishedAt":  scanNullString(access.PublishedAt),
		"chapters":     chapters,
		"participants": participants,
	})
}

func (a *API) handleUpdateTrainingPlan(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	planID, err := parseIDParam(c, "planId")
	if err != nil {
		return err
	}
	user, err := getUser(c)
	if err != nil {
		return err
	}
	var req trainingPlanPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return respondError(c, fiber.StatusBadRequest, "title required")
	}

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	publishedAt := sql.NullString{}
	if req.Published {
		publishedAt = sql.NullString{Valid: true, String: time.Now().UTC().Format(time.RFC3339)}
	}
	res, err := tx.Exec(`
	UPDATE training_plans
	SET title=?, published_at=?
	WHERE id=? AND space_id=?`, req.Title, nullToInterface(publishedAt), planID, spaceID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return respondError(c, fiber.StatusNotFound, "training plan not found in this space")
	}
	if err := upsertTrainingChapters(tx, planID, spaceID, user.ID, req.Chapters); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": planID})
}

func (a *API) handleAddPlanParticipant(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	planID, err := parseIDParam(c, "planId")
	if err != nil {
		return err
	}
	var req participantPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	if req.UserID <= 0 {
		return respondError(c, fiber.StatusBadRequest, "invalid userId")
	}
	res, err := a.DB.Exec(`
	INSERT INTO training_participants(plan_id, user_id, joined_by)
	SELECT id, ?, 'admin'
	FROM training_plans
	WHERE id=? AND space_id=?
	ON CONFLICT(plan_id, user_id)
	DO UPDATE SET joined_by='admin', joined_at=CURRENT_TIMESTAMP`, req.UserID, planID, spaceID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		var exists int
		if err := a.DB.QueryRow(`SELECT COUNT(1) FROM training_plans WHERE id=? AND space_id=?`, planID, spaceID).Scan(&exists); err != nil {
			return err
		}
		if exists == 0 {
			return respondError(c, fiber.StatusNotFound, "training plan not found in this space")
		}
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleSearchTrainingCandidates(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	planID, err := parseIDParam(c, "planId")
	if err != nil {
		return err
	}
	keyword := strings.TrimSpace(c.Query("q"))
	if keyword == "" {
		return respondData(c, []fiber.Map{})
	}

	var exists int
	if err := a.DB.QueryRow(`SELECT COUNT(1) FROM training_plans WHERE id=? AND space_id=?`, planID, spaceID).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		return respondError(c, fiber.StatusNotFound, "training plan not found in this space")
	}

	likeKeyword := "%" + strings.ToLower(keyword) + "%"
	rows, err := a.DB.Query(`
	SELECT u.id, u.username, u.global_role, sm.role
	FROM space_members sm
	JOIN users u ON u.id=sm.user_id
	WHERE sm.space_id=?
	  AND NOT EXISTS (
	    SELECT 1
	    FROM training_participants tp
	    WHERE tp.plan_id=? AND tp.user_id=u.id
	  )
	  AND (
	    CAST(u.id AS TEXT) LIKE ?
	    OR LOWER(u.username) LIKE ?
	  )
	ORDER BY
	  CASE
	    WHEN CAST(u.id AS TEXT)=? THEN 0
	    WHEN LOWER(u.username)=LOWER(?) THEN 1
	    ELSE 2
	  END,
	  u.id ASC
	LIMIT 20`, spaceID, planID, likeKeyword, likeKeyword, keyword, keyword)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var userID int64
		var username, globalRole, role string
		if err := rows.Scan(&userID, &username, &globalRole, &role); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":         userID,
			"username":   username,
			"globalRole": globalRole,
			"role":       role,
		})
	}
	return respondData(c, items)
}

func (a *API) handleDeletePlanParticipant(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	planID, err := parseIDParam(c, "planId")
	if err != nil {
		return err
	}
	participantUserID, err := parseIDParam(c, "userId")
	if err != nil {
		return err
	}
	res, err := a.DB.Exec(`
	DELETE FROM training_participants
	WHERE plan_id=? AND user_id=?
	  AND EXISTS(SELECT 1 FROM training_plans WHERE id=? AND space_id=?)`,
		planID, participantUserID, planID, spaceID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return respondError(c, fiber.StatusNotFound, "participant not found")
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleDeleteTrainingPlan(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	planID, err := parseIDParam(c, "planId")
	if err != nil {
		return err
	}
	deleteProblems := parseBoolQueryParam(c, "deleteProblems")

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	problemIDs, err := collectTrainingProblemIDsTx(tx, spaceID, planID)
	if err != nil {
		return err
	}
	if err := deleteTrainingPlanOwnedRowsTx(tx, planID); err != nil {
		return err
	}
	res, err := tx.Exec(`DELETE FROM training_plans WHERE id=? AND space_id=?`, planID, spaceID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return respondError(c, fiber.StatusNotFound, "training plan not found in this space")
	}

	deletedProblemCount := 0
	problemIDs = uniquePositiveInt64s(problemIDs)
	if deleteProblems {
		deletedProblemCount, err = deleteUnreferencedSpaceProblemsTx(tx, spaceID, problemIDs)
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{
		"ok":                     true,
		"associatedProblemCount": len(problemIDs),
		"deletedProblemCount":    deletedProblemCount,
	})
}

type trainingPlanAccess struct {
	Title       string
	PublishedAt sql.NullString
}

func (a *API) loadTrainingPlanAccess(spaceID, planID, userID int64, globalRole string) (trainingPlanAccess, error) {
	canManage, err := a.isSpaceAdmin(spaceID, userID, globalRole)
	if err != nil {
		return trainingPlanAccess{}, err
	}

	var access trainingPlanAccess
	var publishedAt sql.NullString

	if canManage {
		err = a.DB.QueryRow(`
	SELECT title,  published_at
	FROM training_plans
	WHERE id=? AND space_id=?`, planID, spaceID).
			Scan(&access.Title, &publishedAt)
	} else {
		var isParticipant int
		err = a.DB.QueryRow(`
	SELECT
	  tp.title,
	  tp.published_at,
	  EXISTS(
	    SELECT 1
	    FROM training_participants p
	    WHERE p.plan_id=tp.id AND p.user_id=?
	  )
	FROM training_plans tp
	WHERE tp.id=? AND tp.space_id=?`, userID, planID, spaceID).
			Scan(&access.Title, &publishedAt, &isParticipant)
		if err == nil && isParticipant != 1 {
			return trainingPlanAccess{}, fiber.NewError(fiber.StatusNotFound, "training plan not found in this space")
		}
	}
	if err != nil {
		if err == sql.ErrNoRows {
			return trainingPlanAccess{}, fiber.NewError(fiber.StatusNotFound, "training plan not found in this space")
		}
		return trainingPlanAccess{}, err
	}

	access.PublishedAt = publishedAt
	return access, nil
}

func (a *API) loadPlanChapters(planID, spaceID, userID int64) ([]fiber.Map, error) {
	rows, err := a.DB.Query(`
	SELECT c.id, c.title, c.order_no, i.problem_id, i.order_no, rp.title, rp.type, COALESCE(upp.best_verdict, '')
	FROM training_chapters c
	LEFT JOIN training_items i ON i.chapter_id = c.id
	LEFT JOIN space_problems rp ON rp.id = i.problem_id
	LEFT JOIN user_problem_progress upp ON upp.space_id = ? AND upp.user_id = ? AND upp.problem_id = i.problem_id
	WHERE c.plan_id=?
	ORDER BY c.order_no ASC, i.order_no ASC`, spaceID, userID, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type chapterAgg struct {
		Item fiber.Map
	}
	byID := map[int64]*chapterAgg{}
	order := make([]int64, 0)
	for rows.Next() {
		var cid int64
		var title string
		var cOrder int
		var pID sql.NullInt64
		var pOrder sql.NullInt64
		var problemTitle sql.NullString
		var problemType sql.NullString
		var bestVerdict sql.NullString
		if err := rows.Scan(&cid, &title, &cOrder, &pID, &pOrder, &problemTitle, &problemType, &bestVerdict); err != nil {
			return nil, err
		}
		agg, ok := byID[cid]
		if !ok {
			agg = &chapterAgg{Item: fiber.Map{"id": cid, "title": title, "orderNo": cOrder, "items": []fiber.Map{}}}
			byID[cid] = agg
			order = append(order, cid)
		}
		if pID.Valid {
			items := agg.Item["items"].([]fiber.Map)
			items = append(items, fiber.Map{
				"problemId": pID.Int64,
				"orderNo":   pOrder.Int64,
				"title":     scanNullString(problemTitle),
				"type":      scanNullString(problemType),
				"completed": scanNullString(bestVerdict) == "AC",
			})
			agg.Item["items"] = items
		}
	}
	chapters := make([]fiber.Map, 0, len(order))
	for _, id := range order {
		chapters = append(chapters, byID[id].Item)
	}
	return chapters, nil
}

func (a *API) loadPlanParticipants(planID int64) ([]fiber.Map, error) {
	rows, err := a.DB.Query(`
	SELECT p.user_id, u.username, p.joined_by, p.joined_at
	FROM training_participants p
	JOIN users u ON u.id = p.user_id
	WHERE p.plan_id=?
	ORDER BY p.joined_at DESC`, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	participants := make([]fiber.Map, 0)
	for rows.Next() {
		var userID int64
		var username, joinedBy, joinedAt string
		if err := rows.Scan(&userID, &username, &joinedBy, &joinedAt); err != nil {
			return nil, err
		}
		participants = append(participants, fiber.Map{
			"userId":   userID,
			"username": username,
			"joinedBy": joinedBy,
			"joinedAt": joinedAt,
		})
	}
	return participants, nil
}

func upsertTrainingChapters(tx *sql.Tx, planID, spaceID, createdBy int64, chapters []trainingChapterBody) error {
	if _, err := tx.Exec(`DELETE FROM training_chapters WHERE plan_id=?`, planID); err != nil {
		return err
	}
	for idx, chapter := range chapters {
		if len(chapter.ProblemIDs) > 0 && len(chapter.ProblemDrafts) > 0 {
			return fiber.NewError(fiber.StatusBadRequest, "problemIds and problemDrafts cannot be used together")
		}
		orderNo := chapter.OrderNo
		if orderNo == 0 {
			orderNo = idx + 1
		}
		title := strings.TrimSpace(chapter.Title)
		if title == "" {
			title = "第 " + strconv.Itoa(idx+1) + " 章"
		}
		res, err := tx.Exec(`INSERT INTO training_chapters(plan_id, title, order_no) VALUES(?, ?, ?)`, planID, title, orderNo)
		if err != nil {
			return err
		}
		chapterID, _ := res.LastInsertId()
		problemIDs := append([]int64{}, chapter.ProblemIDs...)
		if len(chapter.ProblemDrafts) > 0 {
			problemIDs = make([]int64, 0, len(chapter.ProblemDrafts))
			for draftIndex := range chapter.ProblemDrafts {
				if err := normalizeProblemPayload(&chapter.ProblemDrafts[draftIndex]); err != nil {
					return err
				}
				problemID, err := insertSpaceProblem(tx, spaceID, createdBy, chapter.ProblemDrafts[draftIndex])
				if err != nil {
					return err
				}
				problemIDs = append(problemIDs, problemID)
			}
		}
		for i, problemID := range problemIDs {
			ok, err := spaceProblemExistsTx(tx, spaceID, problemID)
			if err != nil {
				return err
			}
			if !ok {
				return fiber.NewError(fiber.StatusBadRequest, "problem not found in this space")
			}
			if _, err := tx.Exec(`INSERT INTO training_items(chapter_id, problem_id, order_no) VALUES(?, ?, ?)`, chapterID, problemID, i+1); err != nil {
				return err
			}
		}
	}
	return nil
}

func spaceProblemExistsTx(tx *sql.Tx, spaceID, problemID int64) (bool, error) {
	var count int
	if err := tx.QueryRow(`SELECT COUNT(1) FROM space_problems WHERE id=? AND space_id=?`, problemID, spaceID).Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}

func nullToInterface(v sql.NullString) interface{} {
	if !v.Valid {
		return nil
	}
	return v.String
}

func (a *API) handleTrainingPlanProgress(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	planID, err := parseIDParam(c, "planId")
	if err != nil {
		return err
	}
	if err := a.ensureSpaceReadable(spaceID, user.ID, user.GlobalRole); err != nil {
		return err
	}
	canManage, err := a.isSpaceAdmin(spaceID, user.ID, user.GlobalRole)
	if err != nil || !canManage {
		return respondError(c, fiber.StatusForbidden, "space admin required")
	}

	// Load chapters
	chapters, err := a.loadPlanChapters(planID, spaceID, user.ID)
	if err != nil {
		return err
	}

	// Load participants
	participants, err := a.loadPlanParticipants(planID)
	if err != nil {
		return err
	}

	// Build participant progress
	type participantProgress struct {
		UserID             int64   `json:"userId"`
		Username           string  `json:"username"`
		CompletedProblemIDs []int64 `json:"completedProblemIds"`
	}

	progressList := make([]participantProgress, 0, len(participants))
	for _, p := range participants {
		userID := int64(p["userId"].(int64))
		username := p["username"].(string)

		rows, err := a.DB.Query(`
SELECT i.problem_id
FROM training_chapters c
JOIN training_items i ON i.chapter_id = c.id
JOIN user_problem_progress upp ON upp.problem_id = i.problem_id AND upp.space_id = ? AND upp.user_id = ?
WHERE c.plan_id = ? AND upp.best_verdict = 'AC'
ORDER BY i.problem_id`, spaceID, userID, planID)
		if err != nil {
			return err
		}

		var completedIDs []int64
		for rows.Next() {
			var pid int64
			if err := rows.Scan(&pid); err != nil {
				rows.Close()
				return err
			}
			completedIDs = append(completedIDs, pid)
		}
		rows.Close()

		progressList = append(progressList, participantProgress{
			UserID:             userID,
			Username:           username,
			CompletedProblemIDs: completedIDs,
		})
	}

	return respondData(c, fiber.Map{
		"chapters":     chapters,
		"participants": progressList,
	})
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
