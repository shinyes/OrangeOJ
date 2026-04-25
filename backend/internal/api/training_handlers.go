package api

import (
	"database/sql"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type trainingPlanPayload struct {
	Title         string                `json:"title"`
	AllowSelfJoin bool                  `json:"allowSelfJoin"`
	IsPublic      *bool                 `json:"isPublic"`
	Published     bool                  `json:"published"`
	Chapters      []trainingChapterBody `json:"chapters"`
}

type trainingChapterBody struct {
	Title      string  `json:"title"`
	OrderNo    int     `json:"orderNo"`
	ProblemIDs []int64 `json:"problemIds"`
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
  tp.allow_self_join,
  tp.is_public,
  tp.published_at,
  tp.created_at,
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
  tp.allow_self_join,
  tp.is_public,
  tp.published_at,
  tp.created_at,
  EXISTS(
    SELECT 1
    FROM training_participants p
    WHERE p.plan_id=tp.id AND p.user_id=?
  ) AS joined
FROM training_plans tp
WHERE tp.space_id=?
  AND (
    tp.is_public=1
    OR EXISTS(
      SELECT 1
      FROM training_participants p
      WHERE p.plan_id=tp.id AND p.user_id=?
    )
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
		var allowSelfJoin, isPublic, joined int
		var publishedAt, createdAt sql.NullString
		if err := rows.Scan(&id, &title, &allowSelfJoin, &isPublic, &publishedAt, &createdAt, &joined); err != nil {
			return err
		}
		plans = append(plans, fiber.Map{
			"id":            id,
			"title":         title,
			"allowSelfJoin": allowSelfJoin == 1,
			"isPublic":      isPublic == 1,
			"joined":        joined == 1,
			"published":     publishedAt.Valid,
			"publishedAt":   scanNullString(publishedAt),
			"createdAt":     scanNullString(createdAt),
		})
	}
	return respondData(c, plans)
}

func (a *API) handleCreateTrainingPlan(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
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
INSERT INTO training_plans(space_id, title, allow_self_join, is_public, published_at)
VALUES(?, ?, ?, ?, ?)`, spaceID, req.Title, boolToInt(req.AllowSelfJoin), boolToInt(trainingPlanIsPublic(req.IsPublic)), nullToInterface(publishedAt))
	if err != nil {
		return err
	}
	planID, _ := res.LastInsertId()
	if err := upsertTrainingChapters(tx, planID, req.Chapters); err != nil {
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

	chapters, err := a.loadPlanChapters(planID, spaceID, user.ID)
	if err != nil {
		return err
	}
	participants, err := a.loadPlanParticipants(planID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{
		"id":            planID,
		"spaceId":       spaceID,
		"title":         access.Title,
		"allowSelfJoin": access.AllowSelfJoin,
		"isPublic":      access.IsPublic,
		"published":     access.PublishedAt.Valid,
		"publishedAt":   scanNullString(access.PublishedAt),
		"chapters":      chapters,
		"participants":  participants,
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
SET title=?, allow_self_join=?, is_public=?, published_at=?
WHERE id=? AND space_id=?`, req.Title, boolToInt(req.AllowSelfJoin), boolToInt(trainingPlanIsPublic(req.IsPublic)), nullToInterface(publishedAt), planID, spaceID)
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
	if err := upsertTrainingChapters(tx, planID, req.Chapters); err != nil {
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

func (a *API) handleDeleteTrainingPlan(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	planID, err := parseIDParam(c, "planId")
	if err != nil {
		return err
	}
	res, err := a.DB.Exec(`DELETE FROM training_plans WHERE id=? AND space_id=?`, planID, spaceID)
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
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleJoinPlan(c *fiber.Ctx) error {
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
	if !access.AllowSelfJoin {
		return respondError(c, fiber.StatusForbidden, "self join disabled")
	}
	_, err = a.DB.Exec(`
INSERT INTO training_participants(plan_id, user_id, joined_by)
VALUES(?, ?, 'self')
ON CONFLICT(plan_id, user_id)
DO UPDATE SET joined_by='self', joined_at=CURRENT_TIMESTAMP`, planID, user.ID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

type trainingPlanAccess struct {
	Title         string
	AllowSelfJoin bool
	IsPublic      bool
	PublishedAt   sql.NullString
}

func (a *API) loadTrainingPlanAccess(spaceID, planID, userID int64, globalRole string) (trainingPlanAccess, error) {
	canManage, err := a.isSpaceAdmin(spaceID, userID, globalRole)
	if err != nil {
		return trainingPlanAccess{}, err
	}

	var access trainingPlanAccess
	var allowSelfJoin, isPublic int
	var publishedAt sql.NullString

	if canManage {
		err = a.DB.QueryRow(`
SELECT title, allow_self_join, is_public, published_at
FROM training_plans
WHERE id=? AND space_id=?`, planID, spaceID).
			Scan(&access.Title, &allowSelfJoin, &isPublic, &publishedAt)
	} else {
		var isParticipant int
		err = a.DB.QueryRow(`
SELECT
  tp.title,
  tp.allow_self_join,
  tp.is_public,
  tp.published_at,
  EXISTS(
    SELECT 1
    FROM training_participants p
    WHERE p.plan_id=tp.id AND p.user_id=?
  )
FROM training_plans tp
WHERE tp.id=? AND tp.space_id=?`, userID, planID, spaceID).
			Scan(&access.Title, &allowSelfJoin, &isPublic, &publishedAt, &isParticipant)
		if err == nil && isPublic != 1 && isParticipant != 1 {
			return trainingPlanAccess{}, fiber.NewError(fiber.StatusNotFound, "training plan not found in this space")
		}
	}
	if err != nil {
		if err == sql.ErrNoRows {
			return trainingPlanAccess{}, fiber.NewError(fiber.StatusNotFound, "training plan not found in this space")
		}
		return trainingPlanAccess{}, err
	}

	access.AllowSelfJoin = allowSelfJoin == 1
	access.IsPublic = isPublic == 1
	access.PublishedAt = publishedAt
	return access, nil
}

func (a *API) loadPlanChapters(planID, spaceID, userID int64) ([]fiber.Map, error) {
	rows, err := a.DB.Query(`
SELECT c.id, c.title, c.order_no, i.problem_id, i.order_no, rp.title, rp.type, COALESCE(upp.best_verdict, '')
FROM training_chapters c
LEFT JOIN training_items i ON i.chapter_id = c.id
LEFT JOIN root_problems rp ON rp.id = i.problem_id
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

func upsertTrainingChapters(tx *sql.Tx, planID int64, chapters []trainingChapterBody) error {
	if _, err := tx.Exec(`DELETE FROM training_chapters WHERE plan_id=?`, planID); err != nil {
		return err
	}
	for idx, chapter := range chapters {
		orderNo := chapter.OrderNo
		if orderNo == 0 {
			orderNo = idx + 1
		}
		res, err := tx.Exec(`INSERT INTO training_chapters(plan_id, title, order_no) VALUES(?, ?, ?)`, planID, chapter.Title, orderNo)
		if err != nil {
			return err
		}
		chapterID, _ := res.LastInsertId()
		for i, problemID := range chapter.ProblemIDs {
			if _, err := tx.Exec(`INSERT INTO training_items(chapter_id, problem_id, order_no) VALUES(?, ?, ?)`, chapterID, problemID, i+1); err != nil {
				return err
			}
		}
	}
	return nil
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func trainingPlanIsPublic(v *bool) bool {
	if v == nil {
		return true
	}
	return *v
}

func nullToInterface(v sql.NullString) interface{} {
	if !v.Valid {
		return nil
	}
	return v.String
}
