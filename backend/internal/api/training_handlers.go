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
	rows, err := a.DB.Query(`
SELECT id, title, allow_self_join, published_at, created_at
FROM training_plans
WHERE space_id=?
ORDER BY id DESC`, spaceID)
	if err != nil {
		return err
	}
	defer rows.Close()
	plans := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var title string
		var allowSelfJoin int
		var publishedAt, createdAt sql.NullString
		if err := rows.Scan(&id, &title, &allowSelfJoin, &publishedAt, &createdAt); err != nil {
			return err
		}
		plans = append(plans, fiber.Map{
			"id":            id,
			"title":         title,
			"allowSelfJoin": allowSelfJoin == 1,
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
INSERT INTO training_plans(space_id, title, allow_self_join, published_at)
VALUES(?, ?, ?, ?)`, spaceID, req.Title, boolToInt(req.AllowSelfJoin), nullToInterface(publishedAt))
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

	var title string
	var allowSelfJoin int
	var publishedAt sql.NullString
	if err := a.DB.QueryRow(`SELECT title, allow_self_join, published_at FROM training_plans WHERE id=? AND space_id=?`, planID, spaceID).
		Scan(&title, &allowSelfJoin, &publishedAt); err != nil {
		return err
	}

	chapters, err := a.loadPlanChapters(planID)
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
		"title":         title,
		"allowSelfJoin": allowSelfJoin == 1,
		"publishedAt":   scanNullString(publishedAt),
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
SET title=?, allow_self_join=?, published_at=?
WHERE id=? AND space_id=?`, req.Title, boolToInt(req.AllowSelfJoin), nullToInterface(publishedAt), planID, spaceID)
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
	var allowSelfJoin int
	if err := a.DB.QueryRow(`SELECT allow_self_join FROM training_plans WHERE id=? AND space_id=?`, planID, spaceID).Scan(&allowSelfJoin); err != nil {
		return err
	}
	if allowSelfJoin != 1 {
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

func (a *API) loadPlanChapters(planID int64) ([]fiber.Map, error) {
	rows, err := a.DB.Query(`
SELECT c.id, c.title, c.order_no, i.problem_id, i.order_no
FROM training_chapters c
LEFT JOIN training_items i ON i.chapter_id = c.id
WHERE c.plan_id=?
ORDER BY c.order_no ASC, i.order_no ASC`, planID)
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
		if err := rows.Scan(&cid, &title, &cOrder, &pID, &pOrder); err != nil {
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
			items = append(items, fiber.Map{"problemId": pID.Int64, "orderNo": pOrder.Int64})
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

func nullToInterface(v sql.NullString) interface{} {
	if !v.Valid {
		return nil
	}
	return v.String
}
