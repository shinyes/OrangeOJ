package api

import (
	"database/sql"
	"strings"
	"time"

	oauth "orangeoj/backend/internal/auth"

	"github.com/gofiber/fiber/v2"
)

type practicePayload struct {
	Title         string            `json:"title"`
	Description   string            `json:"description"`
	DueAt         string            `json:"dueAt"`
	DisplayMode   string            `json:"displayMode"`
	Published     bool              `json:"published"`
	Tags          []string          `json:"tags"`
	Items         []practiceItemReq `json:"items"`
	ProblemDrafts []problemPayload  `json:"problemDrafts"`
}

type practiceItemReq struct {
	ProblemID int64 `json:"problemId"`
	OrderNo   int   `json:"orderNo"`
	Score     int   `json:"score"`
}

type practiceTargetPayload struct {
	UserID int64 `json:"userId"`
}

type practiceSubmissionRecordPayload struct {
	Items []practiceSubmissionRecordItemReq `json:"items"`
}

type practiceSubmissionRecordItemReq struct {
	ProblemID    int64 `json:"problemId"`
	SubmissionID int64 `json:"submissionId"`
}

func (a *API) handleListPractices(c *fiber.Ctx) error {
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
	  h.id,
	  h.title,
	  h.description,
	  h.due_at,
	  h.display_mode,
	  h.published,
	  h.created_at,
	  h.tags_json,
	  (
	    SELECT COUNT(1)
	    FROM practice_items hi
	    WHERE hi.practice_id=h.id
	  ) AS item_count,
	  (
	    SELECT COUNT(1)
	    FROM practice_targets ht
	    WHERE ht.practice_id=h.id
	  ) AS target_count,
	  (SELECT GROUP_CONCAT(u.username, ", ") FROM practice_targets ht2 JOIN users u ON u.id=ht2.user_id WHERE ht2.practice_id=h.id) AS target_usernames,
	  EXISTS(
	    SELECT 1
	    FROM practice_targets ht
	    WHERE ht.practice_id=h.id AND ht.user_id=?
	  ) AS assigned
	FROM practices h
	WHERE h.space_id=?
	ORDER BY h.id DESC`
	args := []interface{}{user.ID, spaceID}
	if !canManage {
		query = `
	SELECT
	  h.id,
	  h.title,
	  h.description,
	  h.due_at,
	  h.display_mode,
	  h.published,
	  h.created_at,
	  h.tags_json,
	  (
	    SELECT COUNT(1)
	    FROM practice_items hi
	    WHERE hi.practice_id=h.id
	  ) AS item_count,
	  (
	    SELECT COUNT(1)
	    FROM practice_targets ht
	    WHERE ht.practice_id=h.id
	  ) AS target_count,
	  (SELECT GROUP_CONCAT(u.username, ", ") FROM practice_targets ht2 JOIN users u ON u.id=ht2.user_id WHERE ht2.practice_id=h.id) AS target_usernames,
	  EXISTS(
	    SELECT 1
	    FROM practice_targets ht
	    WHERE ht.practice_id=h.id AND ht.user_id=?
	  ) AS assigned
	FROM practices h
	WHERE h.space_id=?
	  AND h.published=1
	  AND EXISTS(
	    SELECT 1
	    FROM practice_targets ht
	    WHERE ht.practice_id=h.id AND ht.user_id=?
	  )
	ORDER BY h.id DESC`
		args = []interface{}{user.ID, spaceID, user.ID}
	}

	rows, err := a.DB.Query(query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var title, desc, displayMode string
		var tagsJson sql.NullString
		var dueAt, createdAt, targetUsernames sql.NullString
		var published, itemCount, targetCount, assigned int
		if err := rows.Scan(&id, &title, &desc, &dueAt, &displayMode, &published, &createdAt, &tagsJson, &itemCount, &targetCount, &targetUsernames, &assigned); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":          id,
			"title":       title,
			"description": desc,
			"dueAt":       scanNullString(dueAt),
			"displayMode": normalizePracticeDisplayMode(displayMode),
			"published":   published == 1,
			"createdAt":   scanNullString(createdAt),
			"tags":        decodeProblemTags(scanNullString(tagsJson)),
			"itemCount":   itemCount,
			"targetCount":     targetCount,
			"targetUsernames": scanNullString(targetUsernames),
			"assigned":        assigned == 1,
		})
	}
	return respondData(c, items)
}

func (a *API) handleCreatePractice(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	user, err := getUser(c)
	if err != nil {
		return err
	}
	var req practicePayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return respondError(c, fiber.StatusBadRequest, "title required")
	}
	req.DisplayMode = normalizePracticeDisplayMode(req.DisplayMode)
	if req.DisplayMode == "" {
		return respondError(c, fiber.StatusBadRequest, "invalid display mode")
	}
	if len(req.Items) > 0 && len(req.ProblemDrafts) > 0 {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	dueAt := parseNullableTime(req.DueAt)
	tagsJSON, err := encodeProblemTags(req.Tags)
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid tags")
	}
	res, err := tx.Exec(`
	INSERT INTO practices(space_id, title, description, due_at, display_mode, created_by, published, tags_json)
	VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, spaceID, req.Title, req.Description, nullToInterface(dueAt), req.DisplayMode, user.ID, boolToInt(req.Published), tagsJSON)
	if err != nil {
		return err
	}
	practiceID, _ := res.LastInsertId()
	if len(req.ProblemDrafts) > 0 {
		autoItems := make([]practiceItemReq, 0, len(req.ProblemDrafts))
		for index := range req.ProblemDrafts {
			if err := normalizeProblemPayload(&req.ProblemDrafts[index]); err != nil {
				return respondError(c, fiber.StatusBadRequest, err.Error())
			}
			problemID, err := insertSpaceProblem(tx, spaceID, user.ID, req.ProblemDrafts[index])
			if err != nil {
				return err
			}
			autoItems = append(autoItems, practiceItemReq{
				ProblemID: problemID,
				OrderNo:   index + 1,
				Score:     100,
			})
		}
		req.Items = autoItems
	}
	if err := upsertPracticeItems(tx, practiceID, spaceID, req.Items); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": practiceID})
}

func (a *API) handleGetPractice(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	if err := a.ensureSpaceReadable(spaceID, user.ID, user.GlobalRole); err != nil {
		return err
	}
	access, err := a.loadPracticeAccess(spaceID, practiceID, user.ID, user.GlobalRole)
	if err != nil {
		return err
	}
	items, err := a.loadPracticeItems(practiceID)
	if err != nil {
		return err
	}
	targets, err := a.loadPracticeTargets(practiceID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{
		"id":          practiceID,
		"spaceId":     spaceID,
		"title":       access.Title,
		"description": access.Description,
		"tags":        decodeProblemTags(access.Tags),
		"dueAt":       scanNullString(access.DueAt),
		"displayMode": access.DisplayMode,
		"published":   access.Published,
		"items":       items,
		"targets":     targets,
	})
}

func (a *API) handleUpdatePractice(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	var req practicePayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return respondError(c, fiber.StatusBadRequest, "title required")
	}
	req.DisplayMode = normalizePracticeDisplayMode(req.DisplayMode)
	if req.DisplayMode == "" {
		return respondError(c, fiber.StatusBadRequest, "invalid display mode")
	}
	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	dueAt := parseNullableTime(req.DueAt)
	tagsJSON, err := encodeProblemTags(req.Tags)
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid tags")
	}
	res, err := tx.Exec(`
	UPDATE practices
	SET title=?, description=?, due_at=?, display_mode=?, published=?, tags_json=?
	WHERE id=? AND space_id=?`, req.Title, req.Description, nullToInterface(dueAt), req.DisplayMode, boolToInt(req.Published), tagsJSON, practiceID, spaceID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return respondError(c, fiber.StatusNotFound, "practice not found in this space")
	}
	if err := upsertPracticeItems(tx, practiceID, spaceID, req.Items); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": practiceID})
}
func (a *API) handleDeletePractice(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	deleteProblems := parseBoolQueryParam(c, "deleteProblems")

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	problemIDs, err := collectPracticeProblemIDsTx(tx, spaceID, practiceID)
	if err != nil {
		return err
	}
	if err := deletePracticeOwnedRowsTx(tx, practiceID); err != nil {
		return err
	}
	res, err := tx.Exec(`DELETE FROM practices WHERE id=? AND space_id=?`, practiceID, spaceID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return respondError(c, fiber.StatusNotFound, "practice not found in this space")
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

func (a *API) handleAddPracticeTarget(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	var req practiceTargetPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	if req.UserID <= 0 {
		return respondError(c, fiber.StatusBadRequest, "invalid userId")
	}
	res, err := a.DB.Exec(`
INSERT INTO practice_targets(practice_id, user_id)
SELECT id, ?
FROM practices
WHERE id=? AND space_id=?
ON CONFLICT(practice_id, user_id) DO NOTHING`, req.UserID, practiceID, spaceID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		var exists int
		if err := a.DB.QueryRow(`SELECT COUNT(1) FROM practices WHERE id=? AND space_id=?`, practiceID, spaceID).Scan(&exists); err != nil {
			return err
		}
		if exists == 0 {
			return respondError(c, fiber.StatusNotFound, "practice not found in this space")
		}
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleDeletePracticeTarget(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	targetUserID, err := parseIDParam(c, "userId")
	if err != nil {
		return err
	}
	res, err := a.DB.Exec(`
DELETE FROM practice_targets
WHERE practice_id=? AND user_id=?
  AND EXISTS(SELECT 1 FROM practices WHERE id=? AND space_id=?)`,
		practiceID, targetUserID, practiceID, spaceID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return respondError(c, fiber.StatusNotFound, "target not found")
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleSearchPracticeTargetCandidates(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	keyword := strings.TrimSpace(c.Query("q"))
	if keyword == "" {
		return respondData(c, []fiber.Map{})
	}

	var exists int
	if err := a.DB.QueryRow(`SELECT COUNT(1) FROM practices WHERE id=? AND space_id=?`, practiceID, spaceID).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		return respondError(c, fiber.StatusNotFound, "practice not found in this space")
	}

	likeKeyword := "%" + strings.ToLower(keyword) + "%"
	rows, err := a.DB.Query(`
SELECT u.id, u.username, u.global_role, sm.role
FROM space_members sm
JOIN users u ON u.id=sm.user_id
WHERE sm.space_id=?
  AND NOT EXISTS (
    SELECT 1
    FROM practice_targets ht
    WHERE ht.practice_id=? AND ht.user_id=u.id
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
LIMIT 20`, spaceID, practiceID, likeKeyword, likeKeyword, keyword, keyword)
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

func (a *API) handleListPracticeSubmissionRecords(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	if _, err := a.loadPracticeAccess(spaceID, practiceID, user.ID, user.GlobalRole); err != nil {
		return err
	}

	includeAll := false
	if parseBoolQueryParam(c, "all") {
		if user.GlobalRole == "system_admin" {
			includeAll = true
		} else {
			spaceAdmin, err := oauth.IsSpaceAdmin(a.DB, spaceID, user.ID)
			if err != nil {
				return err
			}
			if !spaceAdmin {
				return respondError(c, fiber.StatusForbidden, "space admin required")
			}
			includeAll = true
		}
	}

	records, err := a.loadPracticeSubmissionRecords(practiceID, spaceID, user.ID, includeAll)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"records": records})
}

func (a *API) handleCreatePracticeSubmissionRecord(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	if _, err := a.loadPracticeAccess(spaceID, practiceID, user.ID, user.GlobalRole); err != nil {
		return err
	}

	var req practiceSubmissionRecordPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	practiceItems, err := a.loadPracticeItems(practiceID)
	if err != nil {
		return err
	}
	if len(practiceItems) == 0 {
		return respondError(c, fiber.StatusBadRequest, "submission record items required")
	}

	itemMetaByProblemID := make(map[int64]fiber.Map, len(practiceItems))
	practiceTotalScore := 0
	for _, item := range practiceItems {
		problemID := int64FromAny(item["problemId"])
		itemMetaByProblemID[problemID] = item
		practiceTotalScore += intFromAny(item["score"])
	}

	normalizedItems := make([]practiceSubmissionRecordItemReq, 0, len(req.Items))
	seenProblemIDs := make(map[int64]struct{}, len(req.Items))
	for _, item := range req.Items {
		if item.ProblemID <= 0 || item.SubmissionID <= 0 {
			return respondError(c, fiber.StatusBadRequest, "invalid request")
		}
		if _, ok := itemMetaByProblemID[item.ProblemID]; !ok {
			return respondError(c, fiber.StatusBadRequest, "invalid request")
		}
		if _, duplicated := seenProblemIDs[item.ProblemID]; duplicated {
			continue
		}

		var exists int
		if err := a.DB.QueryRow(`
SELECT COUNT(1)
FROM submissions
WHERE id=? AND user_id=? AND space_id=? AND problem_id=?`, item.SubmissionID, user.ID, spaceID, item.ProblemID).Scan(&exists); err != nil {
			return err
		}
		if exists == 0 {
			return respondError(c, fiber.StatusBadRequest, "invalid request")
		}

		normalizedItems = append(normalizedItems, item)
		seenProblemIDs[item.ProblemID] = struct{}{}
	}
	if len(normalizedItems) == 0 {
		return respondError(c, fiber.StatusBadRequest, "submission record items required")
	}

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
INSERT INTO practice_submission_records(practice_id, space_id, user_id, practice_item_count, practice_total_score)
VALUES(?, ?, ?, ?, ?)`, practiceID, spaceID, user.ID, len(practiceItems), practiceTotalScore)
	if err != nil {
		return err
	}
	recordID, _ := res.LastInsertId()

	for _, item := range normalizedItems {
		meta := itemMetaByProblemID[item.ProblemID]
		if _, err := tx.Exec(`
INSERT INTO practice_submission_record_items(record_id, problem_id, submission_id, order_no, item_score, problem_title, problem_type)
VALUES(?, ?, ?, ?, ?, ?, ?)`,
			recordID,
			item.ProblemID,
			item.SubmissionID,
			intFromAny(meta["orderNo"]),
			intFromAny(meta["score"]),
			stringFromAny(meta["title"]),
			stringFromAny(meta["type"]),
		); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": recordID})
}

func upsertPracticeItems(tx *sql.Tx, practiceID, spaceID int64, items []practiceItemReq) error {
	if _, err := tx.Exec(`DELETE FROM practice_items WHERE practice_id=?`, practiceID); err != nil {
		return err
	}
	for idx, item := range items {
		ok, err := spaceProblemExistsTx(tx, spaceID, item.ProblemID)
		if err != nil {
			return err
		}
		if !ok {
			return fiber.NewError(fiber.StatusBadRequest, "problem not found in this space")
		}
		orderNo := item.OrderNo
		if orderNo == 0 {
			orderNo = idx + 1
		}
		score := item.Score
		if score <= 0 {
			score = 100
		}
		if _, err := tx.Exec(`
INSERT INTO practice_items(practice_id, problem_id, order_no, score)
VALUES(?, ?, ?, ?)`, practiceID, item.ProblemID, orderNo, score); err != nil {
			return err
		}
	}
	return nil
}

func (a *API) loadPracticeItems(practiceID int64) ([]fiber.Map, error) {
	rows, err := a.DB.Query(`
SELECT hi.problem_id, hi.order_no, hi.score, rp.title, rp.type
FROM practice_items hi
JOIN space_problems rp ON rp.id = hi.problem_id
WHERE hi.practice_id=?
ORDER BY hi.order_no ASC`, practiceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]fiber.Map, 0)
	for rows.Next() {
		var problemID int64
		var orderNo, score int
		var title, typeStr string
		if err := rows.Scan(&problemID, &orderNo, &score, &title, &typeStr); err != nil {
			return nil, err
		}
		items = append(items, fiber.Map{"problemId": problemID, "orderNo": orderNo, "score": score, "title": title, "type": typeStr})
	}
	return items, nil
}

func (a *API) loadPracticeTargets(practiceID int64) ([]fiber.Map, error) {
	rows, err := a.DB.Query(`
SELECT ht.user_id, u.username
FROM practice_targets ht
JOIN users u ON u.id = ht.user_id
WHERE ht.practice_id=?`, practiceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	targets := make([]fiber.Map, 0)
	for rows.Next() {
		var userID int64
		var username string
		if err := rows.Scan(&userID, &username); err != nil {
			return nil, err
		}
		targets = append(targets, fiber.Map{"userId": userID, "username": username})
	}
	return targets, nil
}

func (a *API) loadPracticeSubmissionRecords(practiceID, spaceID, userID int64, includeAll bool) ([]fiber.Map, error) {
	type recordMeta struct {
		id                 int64
		userID             int64
		username           string
		practiceItemCount  int
		practiceTotalScore int
		createdAt          string
	}

	query := `
SELECT hsr.id, hsr.user_id, u.username, hsr.practice_item_count, hsr.practice_total_score, hsr.created_at
FROM practice_submission_records hsr
JOIN users u ON u.id = hsr.user_id
WHERE hsr.practice_id=? AND hsr.space_id=?`
	args := []interface{}{practiceID, spaceID}
	if !includeAll {
		query += ` AND hsr.user_id=?`
		args = append(args, userID)
	}
	query += `
ORDER BY hsr.id DESC
LIMIT 30`

	rows, err := a.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	metas := make([]recordMeta, 0)
	for rows.Next() {
		var meta recordMeta
		if err := rows.Scan(&meta.id, &meta.userID, &meta.username, &meta.practiceItemCount, &meta.practiceTotalScore, &meta.createdAt); err != nil {
			return nil, err
		}
		metas = append(metas, meta)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	records := make([]fiber.Map, 0, len(metas))
	for _, meta := range metas {
		items, err := a.loadPracticeSubmissionRecordItems(meta.id)
		if err != nil {
			return nil, err
		}

		answeredCount := len(items)
		objectiveCount := 0
		programmingCount := 0
		acceptedCount := 0
		pendingCount := 0
		resolvedScore := 0
		for _, item := range items {
			if stringFromAny(item["problemType"]) == "programming" {
				programmingCount++
			} else {
				objectiveCount++
			}
			if stringFromAny(item["verdict"]) == "AC" {
				acceptedCount++
				resolvedScore += intFromAny(item["itemScore"])
			}
			status := strings.TrimSpace(stringFromAny(item["status"]))
			if status != "" && status != "done" && status != "failed" {
				pendingCount++
			}
		}

		statusText := "已提交"
		switch {
		case pendingCount > 0:
			statusText = "判题中"
		case answeredCount < meta.practiceItemCount:
			statusText = "部分提交"
		case meta.practiceItemCount > 0 && acceptedCount == meta.practiceItemCount:
			statusText = "全部通过"
		}

		records = append(records, fiber.Map{
			"id":                 meta.id,
			"userId":             meta.userID,
			"username":           meta.username,
			"createdAt":          meta.createdAt,
			"practiceItemCount":  meta.practiceItemCount,
			"practiceTotalScore": meta.practiceTotalScore,
			"answeredCount":      answeredCount,
			"objectiveCount":     objectiveCount,
			"programmingCount":   programmingCount,
			"acceptedCount":      acceptedCount,
			"pendingCount":       pendingCount,
			"resolvedScore":      resolvedScore,
			"statusText":         statusText,
			"items":              items,
		})
	}
	return records, nil
}

func (a *API) loadPracticeSubmissionRecordItems(recordID int64) ([]fiber.Map, error) {
	rows, err := a.DB.Query(`
SELECT
  hsri.problem_id,
  hsri.submission_id,
  hsri.order_no,
  hsri.item_score,
  hsri.problem_title,
  hsri.problem_type,
  s.question_type,
  s.language,
  s.submit_type,
  s.status,
  s.verdict,
  s.score,
  s.created_at,
  s.finished_at
FROM practice_submission_record_items hsri
JOIN submissions s ON s.id = hsri.submission_id
WHERE hsri.record_id=?
ORDER BY hsri.order_no ASC`, recordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var (
			problemID, submissionID                          int64
			orderNo, itemScore, submissionScore              int
			problemTitle, problemType, questionType          string
			language, submitType, status, verdict, createdAt string
			finishedAt                                       sql.NullString
		)
		if err := rows.Scan(
			&problemID,
			&submissionID,
			&orderNo,
			&itemScore,
			&problemTitle,
			&problemType,
			&questionType,
			&language,
			&submitType,
			&status,
			&verdict,
			&submissionScore,
			&createdAt,
			&finishedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, fiber.Map{
			"problemId":       problemID,
			"submissionId":    submissionID,
			"orderNo":         orderNo,
			"itemScore":       itemScore,
			"problemTitle":    problemTitle,
			"problemType":     problemType,
			"questionType":    questionType,
			"language":        language,
			"submitType":      submitType,
			"status":          status,
			"verdict":         verdict,
			"submissionScore": submissionScore,
			"createdAt":       createdAt,
			"finishedAt":      scanNullString(finishedAt),
		})
	}
	return items, nil
}

func parseNullableTime(v string) sql.NullString {
	v = strings.TrimSpace(v)
	if v == "" {
		return sql.NullString{}
	}
	if _, err := time.Parse(time.RFC3339, v); err == nil {
		return sql.NullString{Valid: true, String: v}
	}
	return sql.NullString{}
}

type practiceAccess struct {
	Title       string
	Description string
	Tags        string
	DueAt       sql.NullString
	DisplayMode string
	Published   bool
}

func (a *API) loadPracticeAccess(spaceID, practiceID, userID int64, globalRole string) (practiceAccess, error) {
	canManage, err := a.isSpaceAdmin(spaceID, userID, globalRole)
	if err != nil {
		return practiceAccess{}, err
	}

	var access practiceAccess
	var dueAt sql.NullString
	var published int
	var displayMode string
	if canManage {
		err = a.DB.QueryRow(`
SELECT title, description, tags_json, due_at, display_mode, published
FROM practices
WHERE id=? AND space_id=?`, practiceID, spaceID).
			Scan(&access.Title, &access.Description, &access.Tags, &dueAt, &displayMode, &published)
	} else {
		var assigned, hasTargets int
		err = a.DB.QueryRow(`
SELECT
  h.title,
  h.description,
  h.tags_json,
  h.due_at,
  h.display_mode,
  h.published,
  EXISTS(
    SELECT 1
    FROM practice_targets ht
    WHERE ht.practice_id=h.id AND ht.user_id=?
  ) AS assigned,
  EXISTS(
    SELECT 1
    FROM practice_targets ht
    WHERE ht.practice_id=h.id
  ) AS has_targets
FROM practices h
WHERE h.id=? AND h.space_id=?`, userID, practiceID, spaceID).
			Scan(&access.Title, &access.Description, &access.Tags, &dueAt, &displayMode, &published, &assigned, &hasTargets)
		if err == nil && (published != 1 || (hasTargets == 1 && assigned != 1)) {
			return practiceAccess{}, fiber.NewError(fiber.StatusNotFound, "practice not found in this space")
		}
	}
	if err != nil {
		if err == sql.ErrNoRows {
			return practiceAccess{}, fiber.NewError(fiber.StatusNotFound, "practice not found in this space")
		}
		return practiceAccess{}, err
	}
	access.DueAt = dueAt
	access.DisplayMode = normalizePracticeDisplayMode(displayMode)
	if access.DisplayMode == "" {
		access.DisplayMode = normalizePracticeDisplayMode("")
	}
	access.Published = published == 1
	return access, nil
}

func normalizePracticeDisplayMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "exam", "paper":
		return "exam"
	case "list", "problem_set", "problemset":
		return "list"
	default:
		return ""
	}
}

func intFromAny(v interface{}) int {
	switch value := v.(type) {
	case int:
		return value
	case int64:
		return int(value)
	case float64:
		return int(value)
	default:
		return 0
	}
}

func int64FromAny(v interface{}) int64 {
	switch value := v.(type) {
	case int:
		return int64(value)
	case int64:
		return value
	case float64:
		return int64(value)
	default:
		return 0
	}
}

func (a *API) handleGetPracticeDraft(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	if _, err := a.loadPracticeAccess(spaceID, practiceID, user.ID, user.GlobalRole); err != nil {
		return err
	}

	var draftJSON string
	var updatedAt string
	err = a.DB.QueryRow(`
SELECT draft_json, updated_at
FROM practice_drafts
WHERE user_id=? AND space_id=? AND practice_id=?`, user.ID, spaceID, practiceID).Scan(&draftJSON, &updatedAt)
	if err == sql.ErrNoRows {
		return respondData(c, nil)
	}
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{
		"draft":     draftJSON,
		"updatedAt": updatedAt,
	})
}

func (a *API) handleSavePracticeDraft(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	if _, err := a.loadPracticeAccess(spaceID, practiceID, user.ID, user.GlobalRole); err != nil {
		return err
	}

	var req struct {
		Draft string `json:"draft"`
	}
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	_, err = a.DB.Exec(`
INSERT INTO practice_drafts(user_id, space_id, practice_id, draft_json, updated_at)
VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(user_id, space_id, practice_id)
DO UPDATE SET draft_json=excluded.draft_json, updated_at=CURRENT_TIMESTAMP`,
		user.ID, spaceID, practiceID, req.Draft)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleDeletePracticeDraft(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
	if err != nil {
		return err
	}
	_, err = a.DB.Exec(`
DELETE FROM practice_drafts
WHERE user_id=? AND space_id=? AND practice_id=?`,
		user.ID, spaceID, practiceID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func stringFromAny(v interface{}) string {
	s, _ := v.(string)
	return s
}