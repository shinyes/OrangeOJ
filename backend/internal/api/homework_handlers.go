package api

import (
	"database/sql"
	"strings"
	"time"

	oauth "orangeoj/backend/internal/auth"

	"github.com/gofiber/fiber/v2"
)

type homeworkPayload struct {
	Title       string            `json:"title"`
	Description string            `json:"description"`
	DueAt       string            `json:"dueAt"`
	DisplayMode string            `json:"displayMode"`
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

type homeworkSubmissionRecordPayload struct {
	Items []homeworkSubmissionRecordItemReq `json:"items"`
}

type homeworkSubmissionRecordItemReq struct {
	ProblemID    int64 `json:"problemId"`
	SubmissionID int64 `json:"submissionId"`
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
  (
    SELECT COUNT(1)
    FROM homework_items hi
    WHERE hi.homework_id=h.id
  ) AS item_count,
  (
    SELECT COUNT(1)
    FROM homework_targets ht
    WHERE ht.homework_id=h.id
  ) AS target_count,
  EXISTS(
    SELECT 1
    FROM homework_targets ht
    WHERE ht.homework_id=h.id AND ht.user_id=?
  ) AS assigned
FROM homeworks h
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
  (
    SELECT COUNT(1)
    FROM homework_items hi
    WHERE hi.homework_id=h.id
  ) AS item_count,
  (
    SELECT COUNT(1)
    FROM homework_targets ht
    WHERE ht.homework_id=h.id
  ) AS target_count,
  EXISTS(
    SELECT 1
    FROM homework_targets ht
    WHERE ht.homework_id=h.id AND ht.user_id=?
  ) AS assigned
FROM homeworks h
WHERE h.space_id=?
  AND h.published=1
  AND (
    NOT EXISTS(
      SELECT 1
      FROM homework_targets ht
      WHERE ht.homework_id=h.id
    )
    OR EXISTS(
      SELECT 1
      FROM homework_targets ht
      WHERE ht.homework_id=h.id AND ht.user_id=?
    )
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
		var dueAt, createdAt sql.NullString
		var published, itemCount, targetCount, assigned int
		if err := rows.Scan(&id, &title, &desc, &dueAt, &displayMode, &published, &createdAt, &itemCount, &targetCount, &assigned); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":          id,
			"title":       title,
			"description": desc,
			"dueAt":       scanNullString(dueAt),
			"displayMode": normalizeHomeworkDisplayMode(displayMode),
			"published":   published == 1,
			"createdAt":   scanNullString(createdAt),
			"itemCount":   itemCount,
			"targetCount": targetCount,
			"assigned":    assigned == 1,
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
	req.DisplayMode = normalizeHomeworkDisplayMode(req.DisplayMode)
	if req.DisplayMode == "" {
		return respondError(c, fiber.StatusBadRequest, "invalid display mode")
	}

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	dueAt := parseNullableTime(req.DueAt)
	res, err := tx.Exec(`
INSERT INTO homeworks(space_id, title, description, due_at, display_mode, created_by, published)
VALUES(?, ?, ?, ?, ?, ?, ?)`, spaceID, req.Title, req.Description, nullToInterface(dueAt), req.DisplayMode, user.ID, boolToInt(req.Published))
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
	access, err := a.loadHomeworkAccess(spaceID, homeworkID, user.ID, user.GlobalRole)
	if err != nil {
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
		"title":       access.Title,
		"description": access.Description,
		"dueAt":       scanNullString(access.DueAt),
		"displayMode": access.DisplayMode,
		"published":   access.Published,
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
	req.DisplayMode = normalizeHomeworkDisplayMode(req.DisplayMode)
	if req.DisplayMode == "" {
		return respondError(c, fiber.StatusBadRequest, "invalid display mode")
	}
	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	dueAt := parseNullableTime(req.DueAt)
	res, err := tx.Exec(`
UPDATE homeworks
SET title=?, description=?, due_at=?, display_mode=?, published=?
WHERE id=? AND space_id=?`, req.Title, req.Description, nullToInterface(dueAt), req.DisplayMode, boolToInt(req.Published), homeworkID, spaceID)
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

func (a *API) handleDeleteHomework(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	homeworkID, err := parseIDParam(c, "homeworkId")
	if err != nil {
		return err
	}
	res, err := a.DB.Exec(`DELETE FROM homeworks WHERE id=? AND space_id=?`, homeworkID, spaceID)
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
	return respondData(c, fiber.Map{"ok": true})
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

func (a *API) handleListHomeworkSubmissionRecords(c *fiber.Ctx) error {
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
	if _, err := a.loadHomeworkAccess(spaceID, homeworkID, user.ID, user.GlobalRole); err != nil {
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

	records, err := a.loadHomeworkSubmissionRecords(homeworkID, spaceID, user.ID, includeAll)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"records": records})
}

func (a *API) handleCreateHomeworkSubmissionRecord(c *fiber.Ctx) error {
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
	if _, err := a.loadHomeworkAccess(spaceID, homeworkID, user.ID, user.GlobalRole); err != nil {
		return err
	}

	var req homeworkSubmissionRecordPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	homeworkItems, err := a.loadHomeworkItems(homeworkID)
	if err != nil {
		return err
	}
	if len(homeworkItems) == 0 {
		return respondError(c, fiber.StatusBadRequest, "submission record items required")
	}

	itemMetaByProblemID := make(map[int64]fiber.Map, len(homeworkItems))
	homeworkTotalScore := 0
	for _, item := range homeworkItems {
		problemID := int64FromAny(item["problemId"])
		itemMetaByProblemID[problemID] = item
		homeworkTotalScore += intFromAny(item["score"])
	}

	normalizedItems := make([]homeworkSubmissionRecordItemReq, 0, len(req.Items))
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
INSERT INTO homework_submission_records(homework_id, space_id, user_id, homework_item_count, homework_total_score)
VALUES(?, ?, ?, ?, ?)`, homeworkID, spaceID, user.ID, len(homeworkItems), homeworkTotalScore)
	if err != nil {
		return err
	}
	recordID, _ := res.LastInsertId()

	for _, item := range normalizedItems {
		meta := itemMetaByProblemID[item.ProblemID]
		if _, err := tx.Exec(`
INSERT INTO homework_submission_record_items(record_id, problem_id, submission_id, order_no, item_score, problem_title, problem_type)
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

func (a *API) loadHomeworkSubmissionRecords(homeworkID, spaceID, userID int64, includeAll bool) ([]fiber.Map, error) {
	type recordMeta struct {
		id                 int64
		userID             int64
		username           string
		homeworkItemCount  int
		homeworkTotalScore int
		createdAt          string
	}

	query := `
SELECT hsr.id, hsr.user_id, u.username, hsr.homework_item_count, hsr.homework_total_score, hsr.created_at
FROM homework_submission_records hsr
JOIN users u ON u.id = hsr.user_id
WHERE hsr.homework_id=? AND hsr.space_id=?`
	args := []interface{}{homeworkID, spaceID}
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
		if err := rows.Scan(&meta.id, &meta.userID, &meta.username, &meta.homeworkItemCount, &meta.homeworkTotalScore, &meta.createdAt); err != nil {
			return nil, err
		}
		metas = append(metas, meta)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	records := make([]fiber.Map, 0, len(metas))
	for _, meta := range metas {
		items, err := a.loadHomeworkSubmissionRecordItems(meta.id)
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
		case answeredCount < meta.homeworkItemCount:
			statusText = "部分提交"
		case meta.homeworkItemCount > 0 && acceptedCount == meta.homeworkItemCount:
			statusText = "全部通过"
		}

		records = append(records, fiber.Map{
			"id":                 meta.id,
			"userId":             meta.userID,
			"username":           meta.username,
			"createdAt":          meta.createdAt,
			"homeworkItemCount":  meta.homeworkItemCount,
			"homeworkTotalScore": meta.homeworkTotalScore,
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

func (a *API) loadHomeworkSubmissionRecordItems(recordID int64) ([]fiber.Map, error) {
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
FROM homework_submission_record_items hsri
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

type homeworkAccess struct {
	Title       string
	Description string
	DueAt       sql.NullString
	DisplayMode string
	Published   bool
}

func (a *API) loadHomeworkAccess(spaceID, homeworkID, userID int64, globalRole string) (homeworkAccess, error) {
	canManage, err := a.isSpaceAdmin(spaceID, userID, globalRole)
	if err != nil {
		return homeworkAccess{}, err
	}

	var access homeworkAccess
	var dueAt sql.NullString
	var published int
	var displayMode string
	if canManage {
		err = a.DB.QueryRow(`
SELECT title, description, due_at, display_mode, published
FROM homeworks
WHERE id=? AND space_id=?`, homeworkID, spaceID).
			Scan(&access.Title, &access.Description, &dueAt, &displayMode, &published)
	} else {
		var assigned, hasTargets int
		err = a.DB.QueryRow(`
SELECT
  h.title,
  h.description,
  h.due_at,
  h.display_mode,
  h.published,
  EXISTS(
    SELECT 1
    FROM homework_targets ht
    WHERE ht.homework_id=h.id AND ht.user_id=?
  ) AS assigned,
  EXISTS(
    SELECT 1
    FROM homework_targets ht
    WHERE ht.homework_id=h.id
  ) AS has_targets
FROM homeworks h
WHERE h.id=? AND h.space_id=?`, userID, homeworkID, spaceID).
			Scan(&access.Title, &access.Description, &dueAt, &displayMode, &published, &assigned, &hasTargets)
		if err == nil && (published != 1 || (hasTargets == 1 && assigned != 1)) {
			return homeworkAccess{}, fiber.NewError(fiber.StatusNotFound, "homework not found in this space")
		}
	}
	if err != nil {
		if err == sql.ErrNoRows {
			return homeworkAccess{}, fiber.NewError(fiber.StatusNotFound, "homework not found in this space")
		}
		return homeworkAccess{}, err
	}
	access.DueAt = dueAt
	access.DisplayMode = normalizeHomeworkDisplayMode(displayMode)
	if access.DisplayMode == "" {
		access.DisplayMode = normalizeHomeworkDisplayMode("")
	}
	access.Published = published == 1
	return access, nil
}

func normalizeHomeworkDisplayMode(raw string) string {
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

func stringFromAny(v interface{}) string {
	s, _ := v.(string)
	return s
}
