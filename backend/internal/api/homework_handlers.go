package api

import (
	"database/sql"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type homeworkPayload struct {
	Title       string            `json:"title"`
	Description string            `json:"description"`
	DueAt       string            `json:"dueAt"`
	Published   bool              `json:"published"`
	Items       []homeworkItemReq `json:"items"`
}

type homeworkItemReq struct {
	ProblemID int64 `json:"problemId"`
	OrderNo   int   `json:"orderNo"`
	Score     int   `json:"score"`
}

type homeworkTargetPayload struct {
	UserID int64 `json:"userId"`
}

func (a *API) handleListHomeworks(c *fiber.Ctx) error {
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
SELECT id, title, description, due_at, published, created_at
FROM homeworks
WHERE space_id=?
ORDER BY id DESC`, spaceID)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var title, desc string
		var dueAt, createdAt sql.NullString
		var published int
		if err := rows.Scan(&id, &title, &desc, &dueAt, &published, &createdAt); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":          id,
			"title":       title,
			"description": desc,
			"dueAt":       scanNullString(dueAt),
			"published":   published == 1,
			"createdAt":   scanNullString(createdAt),
		})
	}
	return respondData(c, items)
}

func (a *API) handleCreateHomework(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	user, err := getUser(c)
	if err != nil {
		return err
	}
	var req homeworkPayload
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

	dueAt := parseNullableTime(req.DueAt)
	res, err := tx.Exec(`
INSERT INTO homeworks(space_id, title, description, due_at, created_by, published)
VALUES(?, ?, ?, ?, ?, ?)`, spaceID, req.Title, req.Description, nullToInterface(dueAt), user.ID, boolToInt(req.Published))
	if err != nil {
		return err
	}
	homeworkID, _ := res.LastInsertId()
	if err := upsertHomeworkItems(tx, homeworkID, req.Items); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": homeworkID})
}

func (a *API) handleGetHomework(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	homeworkID, err := parseIDParam(c, "homeworkId")
	if err != nil {
		return err
	}
	if err := a.ensureSpaceReadable(spaceID, user.ID, user.GlobalRole); err != nil {
		return err
	}

	var title, desc string
	var dueAt sql.NullString
	var published int
	if err := a.DB.QueryRow(`
SELECT title, description, due_at, published
FROM homeworks
WHERE id=? AND space_id=?`, homeworkID, spaceID).Scan(&title, &desc, &dueAt, &published); err != nil {
		return err
	}
	items, err := a.loadHomeworkItems(homeworkID)
	if err != nil {
		return err
	}
	targets, err := a.loadHomeworkTargets(homeworkID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{
		"id":          homeworkID,
		"spaceId":     spaceID,
		"title":       title,
		"description": desc,
		"dueAt":       scanNullString(dueAt),
		"published":   published == 1,
		"items":       items,
		"targets":     targets,
	})
}

func (a *API) handleUpdateHomework(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	homeworkID, err := parseIDParam(c, "homeworkId")
	if err != nil {
		return err
	}
	var req homeworkPayload
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

	dueAt := parseNullableTime(req.DueAt)
	res, err := tx.Exec(`
UPDATE homeworks
SET title=?, description=?, due_at=?, published=?
WHERE id=? AND space_id=?`, req.Title, req.Description, nullToInterface(dueAt), boolToInt(req.Published), homeworkID, spaceID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return respondError(c, fiber.StatusNotFound, "homework not found in this space")
	}
	if err := upsertHomeworkItems(tx, homeworkID, req.Items); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": homeworkID})
}

func (a *API) handleAddHomeworkTarget(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	homeworkID, err := parseIDParam(c, "homeworkId")
	if err != nil {
		return err
	}
	var req homeworkTargetPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	if req.UserID <= 0 {
		return respondError(c, fiber.StatusBadRequest, "invalid userId")
	}
	res, err := a.DB.Exec(`
INSERT INTO homework_targets(homework_id, user_id)
SELECT id, ?
FROM homeworks
WHERE id=? AND space_id=?
ON CONFLICT(homework_id, user_id) DO NOTHING`, req.UserID, homeworkID, spaceID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		var exists int
		if err := a.DB.QueryRow(`SELECT COUNT(1) FROM homeworks WHERE id=? AND space_id=?`, homeworkID, spaceID).Scan(&exists); err != nil {
			return err
		}
		if exists == 0 {
			return respondError(c, fiber.StatusNotFound, "homework not found in this space")
		}
	}
	return respondData(c, fiber.Map{"ok": true})
}

func upsertHomeworkItems(tx *sql.Tx, homeworkID int64, items []homeworkItemReq) error {
	if _, err := tx.Exec(`DELETE FROM homework_items WHERE homework_id=?`, homeworkID); err != nil {
		return err
	}
	for idx, item := range items {
		orderNo := item.OrderNo
		if orderNo == 0 {
			orderNo = idx + 1
		}
		score := item.Score
		if score <= 0 {
			score = 100
		}
		if _, err := tx.Exec(`
INSERT INTO homework_items(homework_id, problem_id, order_no, score)
VALUES(?, ?, ?, ?)`, homeworkID, item.ProblemID, orderNo, score); err != nil {
			return err
		}
	}
	return nil
}

func (a *API) loadHomeworkItems(homeworkID int64) ([]fiber.Map, error) {
	rows, err := a.DB.Query(`
SELECT hi.problem_id, hi.order_no, hi.score, rp.title, rp.type
FROM homework_items hi
JOIN root_problems rp ON rp.id = hi.problem_id
WHERE hi.homework_id=?
ORDER BY hi.order_no ASC`, homeworkID)
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

func (a *API) loadHomeworkTargets(homeworkID int64) ([]fiber.Map, error) {
	rows, err := a.DB.Query(`
SELECT ht.user_id, u.username
FROM homework_targets ht
JOIN users u ON u.id = ht.user_id
WHERE ht.homework_id=?`, homeworkID)
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
