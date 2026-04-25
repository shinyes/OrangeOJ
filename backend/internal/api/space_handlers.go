package api

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type memberPayload struct {
	UserID int64  `json:"userId"`
	Role   string `json:"role"`
}

type linkPayload struct {
	ProblemID int64 `json:"problemId"`
}

type spaceSettingsPayload struct {
	Name                       string `json:"name"`
	Description                string `json:"description"`
	DefaultProgrammingLanguage string `json:"defaultProgrammingLanguage"`
}

func (a *API) handleCreateSpaceProblem(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	user, err := getUser(c)
	if err != nil {
		return err
	}

	var req rootProblemPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Type = normalizeProblemType(req.Type)
	if req.Title == "" || req.Type == "" {
		return respondError(c, fiber.StatusBadRequest, "type and title are required")
	}
	if !isValidProblemType(req.Type) {
		return respondError(c, fiber.StatusBadRequest, "invalid problem type")
	}
	if req.TimeLimitMS <= 0 {
		req.TimeLimitMS = 1000
	}
	if req.MemoryLimitMiB <= 0 {
		req.MemoryLimitMiB = 256
	}
	if len(req.BodyJSON) == 0 {
		req.BodyJSON = json.RawMessage(`{}`)
	}
	if len(req.AnswerJSON) == 0 {
		req.AnswerJSON = json.RawMessage(`{}`)
	}
	tagsJSON, err := encodeProblemTags(req.Tags)
	if err != nil {
		return err
	}

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
INSERT INTO root_problems(type, title, tags_json, statement_md, body_json, answer_json, time_limit_ms, memory_limit_mib, created_by)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`, req.Type, req.Title, tagsJSON, req.StatementMD, string(req.BodyJSON), string(req.AnswerJSON), req.TimeLimitMS, req.MemoryLimitMiB, user.ID)
	if err != nil {
		return err
	}
	problemID, _ := res.LastInsertId()

	if _, err := tx.Exec(`INSERT INTO space_problem_links(space_id, problem_id) VALUES(?, ?)`, spaceID, problemID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": problemID, "linked": true})
}

func (a *API) handleListSpaces(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	query := `
SELECT s.id, s.name, s.description, s.default_programming_language, s.created_by, s.created_at,
       COALESCE(sm.role, '') AS my_role
FROM spaces s
LEFT JOIN space_members sm ON sm.space_id=s.id AND sm.user_id=?`
	args := []interface{}{user.ID}
	if user.GlobalRole != "system_admin" {
		query += ` WHERE sm.user_id IS NOT NULL`
	}
	query += ` ORDER BY s.id DESC`

	rows, err := a.DB.Query(query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id, createdBy int64
		var name, description, defaultLanguage, myRole string
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &description, &defaultLanguage, &createdBy, &createdAt, &myRole); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":                         id,
			"name":                       name,
			"description":                description,
			"defaultProgrammingLanguage": normalizeSpaceProgrammingLanguage(defaultLanguage),
			"createdBy":                  createdBy,
			"createdAt":                  createdAt,
			"myRole":                     myRole,
		})
	}
	return respondData(c, items)
}

func (a *API) handleGetSpace(c *fiber.Ctx) error {
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

	var id, createdBy int64
	var name, description, defaultLanguage, myRole string
	var createdAt time.Time
	if err := a.DB.QueryRow(`
SELECT s.id, s.name, s.description, s.default_programming_language, s.created_by, s.created_at, COALESCE(sm.role, '') AS my_role
FROM spaces s
LEFT JOIN space_members sm ON sm.space_id=s.id AND sm.user_id=?
WHERE s.id=?`, user.ID, spaceID).
		Scan(&id, &name, &description, &defaultLanguage, &createdBy, &createdAt, &myRole); err != nil {
		return err
	}
	canManage := user.GlobalRole == "system_admin" || myRole == "space_admin"
	return respondData(c, fiber.Map{
		"id":                         id,
		"name":                       name,
		"description":                description,
		"defaultProgrammingLanguage": normalizeSpaceProgrammingLanguage(defaultLanguage),
		"createdBy":                  createdBy,
		"createdAt":                  createdAt,
		"myRole":                     myRole,
		"canManage":                  canManage,
	})
}

func (a *API) handleUpdateSpace(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	var req spaceSettingsPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	if req.Name == "" {
		return respondError(c, fiber.StatusBadRequest, "name required")
	}
	if !isValidSpaceProgrammingLanguage(req.DefaultProgrammingLanguage) {
		return respondError(c, fiber.StatusBadRequest, "invalid language")
	}
	defaultLanguage := normalizeSpaceProgrammingLanguage(req.DefaultProgrammingLanguage)
	_, err = a.DB.Exec(`
UPDATE spaces
SET name=?, description=?, default_programming_language=?
WHERE id=?`, req.Name, req.Description, defaultLanguage, spaceID)
	if err != nil {
		if isUniqueErr(err) {
			return respondError(c, fiber.StatusConflict, "space name already exists")
		}
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleAddSpaceMember(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	var req memberPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	if req.UserID <= 0 {
		return respondError(c, fiber.StatusBadRequest, "invalid userId")
	}
	if req.Role == "" {
		req.Role = "member"
	}
	if req.Role != "member" && req.Role != "space_admin" {
		return respondError(c, fiber.StatusBadRequest, "invalid role")
	}
	_, err = a.DB.Exec(`
INSERT INTO space_members(space_id, user_id, role)
VALUES(?, ?, ?)
ON CONFLICT(space_id, user_id)
DO UPDATE SET role=excluded.role`, spaceID, req.UserID, req.Role)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleListSpaceMembers(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	rows, err := a.DB.Query(`
SELECT sm.user_id, u.username, sm.role, u.global_role, sm.created_at
FROM space_members sm
JOIN users u ON u.id = sm.user_id
WHERE sm.space_id=?
ORDER BY CASE sm.role WHEN 'space_admin' THEN 0 ELSE 1 END, sm.user_id ASC`, spaceID)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var userID int64
		var username, role, globalRole string
		var createdAt time.Time
		if err := rows.Scan(&userID, &username, &role, &globalRole, &createdAt); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"userId":     userID,
			"username":   username,
			"role":       role,
			"globalRole": globalRole,
			"createdAt":  createdAt,
		})
	}
	return respondData(c, items)
}

func (a *API) handleSearchSpaceMemberCandidates(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	keyword := strings.TrimSpace(c.Query("q"))
	if keyword == "" {
		return respondData(c, []fiber.Map{})
	}

	likeKeyword := "%" + strings.ToLower(keyword) + "%"
	rows, err := a.DB.Query(`
SELECT u.id, u.username, u.global_role
FROM users u
WHERE NOT EXISTS (
	SELECT 1
	FROM space_members sm
	WHERE sm.space_id=? AND sm.user_id=u.id
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
LIMIT 20`, spaceID, likeKeyword, likeKeyword, keyword, keyword)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var userID int64
		var username, globalRole string
		if err := rows.Scan(&userID, &username, &globalRole); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":         userID,
			"username":   username,
			"globalRole": globalRole,
		})
	}
	return respondData(c, items)
}

func (a *API) handleUpdateSpaceMember(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	userID, err := parseIDParam(c, "userId")
	if err != nil {
		return err
	}
	var req memberPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	if req.Role != "member" && req.Role != "space_admin" {
		return respondError(c, fiber.StatusBadRequest, "invalid role")
	}
	_, err = a.DB.Exec(`UPDATE space_members SET role=? WHERE space_id=? AND user_id=?`, req.Role, spaceID, userID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleDeleteSpaceMember(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	userID, err := parseIDParam(c, "userId")
	if err != nil {
		return err
	}
	res, err := a.DB.Exec(`DELETE FROM space_members WHERE space_id=? AND user_id=?`, spaceID, userID)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return respondError(c, fiber.StatusNotFound, "user is not in this space")
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleListSpaceProblemLinks(c *fiber.Ctx) error {
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
SELECT p.id, p.type, p.title, p.tags_json, p.statement_md, p.time_limit_ms, p.memory_limit_mib, COALESCE(upp.best_verdict, '')
FROM space_problem_links l
JOIN root_problems p ON p.id = l.problem_id
LEFT JOIN user_problem_progress upp ON upp.space_id = l.space_id AND upp.user_id = ? AND upp.problem_id = p.id
WHERE l.space_id=?
ORDER BY p.id DESC`, user.ID, spaceID)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id, timeLimit, memoryLimit int64
		var typeStr, title, tagsJSON, statement, bestVerdict string
		if err := rows.Scan(&id, &typeStr, &title, &tagsJSON, &statement, &timeLimit, &memoryLimit, &bestVerdict); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":             id,
			"type":           typeStr,
			"title":          title,
			"tags":           decodeProblemTags(tagsJSON),
			"statementMd":    statement,
			"timeLimitMs":    timeLimit,
			"memoryLimitMiB": memoryLimit,
			"completed":      bestVerdict == "AC",
		})
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return respondData(c, items)
}

func (a *API) handleAddSpaceProblemLink(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	var req linkPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	if req.ProblemID <= 0 {
		return respondError(c, fiber.StatusBadRequest, "problemId required")
	}
	_, err = a.DB.Exec(`INSERT INTO space_problem_links(space_id, problem_id) VALUES(?, ?)`, spaceID, req.ProblemID)
	if err != nil {
		if isUniqueErr(err) {
			return respondError(c, fiber.StatusConflict, "problem already linked")
		}
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleDeleteSpaceProblemLink(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	problemID, err := parseIDParam(c, "problemId")
	if err != nil {
		return err
	}
	_, err = a.DB.Exec(`DELETE FROM space_problem_links WHERE space_id=? AND problem_id=?`, spaceID, problemID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleListSpaceRootProblems(c *fiber.Ctx) error {
	rows, err := a.DB.Query(`
SELECT id, type, title, tags_json, statement_md, body_json, answer_json, time_limit_ms, memory_limit_mib
FROM root_problems
ORDER BY id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var (
			id, timeLimit, memoryLimit                                int64
			typeStr, title, tagsJSON, statement, bodyJSON, answerJSON string
		)
		if err := rows.Scan(&id, &typeStr, &title, &tagsJSON, &statement, &bodyJSON, &answerJSON, &timeLimit, &memoryLimit); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":             id,
			"type":           typeStr,
			"title":          title,
			"tags":           decodeProblemTags(tagsJSON),
			"statementMd":    statement,
			"bodyJson":       json.RawMessage(bodyJSON),
			"answerJson":     json.RawMessage(answerJSON),
			"timeLimitMs":    timeLimit,
			"memoryLimitMiB": memoryLimit,
		})
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return respondData(c, items)
}

func (a *API) handleUpdateSpaceProblem(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	problemID, err := parseIDParam(c, "problemId")
	if err != nil {
		return err
	}
	var linkedCount int
	if err := a.DB.QueryRow(`SELECT COUNT(1) FROM space_problem_links WHERE space_id=? AND problem_id=?`, spaceID, problemID).Scan(&linkedCount); err != nil {
		return err
	}
	if linkedCount == 0 {
		return respondError(c, fiber.StatusNotFound, "problem not linked in this space")
	}

	var req rootProblemPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Type = normalizeProblemType(req.Type)
	if req.Title == "" || req.Type == "" {
		return respondError(c, fiber.StatusBadRequest, "type and title are required")
	}
	if !isValidProblemType(req.Type) {
		return respondError(c, fiber.StatusBadRequest, "invalid problem type")
	}
	if req.TimeLimitMS <= 0 {
		req.TimeLimitMS = 1000
	}
	if req.MemoryLimitMiB <= 0 {
		req.MemoryLimitMiB = 256
	}
	if len(req.BodyJSON) == 0 {
		req.BodyJSON = json.RawMessage(`{}`)
	}
	if len(req.AnswerJSON) == 0 {
		req.AnswerJSON = json.RawMessage(`{}`)
	}
	tagsJSON, err := encodeProblemTags(req.Tags)
	if err != nil {
		return err
	}
	_, err = a.DB.Exec(`
UPDATE root_problems
SET type=?, title=?, tags_json=?, statement_md=?, body_json=?, answer_json=?, time_limit_ms=?, memory_limit_mib=?
WHERE id=?`, req.Type, req.Title, tagsJSON, req.StatementMD, string(req.BodyJSON), string(req.AnswerJSON), req.TimeLimitMS, req.MemoryLimitMiB, problemID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": problemID})
}

func (a *API) handleGetSpaceProblem(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	problemID, err := parseIDParam(c, "problemId")
	if err != nil {
		return err
	}
	if err := a.ensureSpaceReadable(spaceID, user.ID, user.GlobalRole); err != nil {
		return err
	}

	var count int
	if err := a.DB.QueryRow(`SELECT COUNT(1) FROM space_problem_links WHERE space_id=? AND problem_id=?`, spaceID, problemID).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		return respondError(c, fiber.StatusNotFound, "problem not linked in this space")
	}

	var (
		typeStr, title, tagsJSON, statement, bodyJSON string
		timeLimit, memoryLimit                        int64
	)
	err = a.DB.QueryRow(`
SELECT type, title, tags_json, statement_md, body_json, time_limit_ms, memory_limit_mib
FROM root_problems WHERE id=?`, problemID).Scan(&typeStr, &title, &tagsJSON, &statement, &bodyJSON, &timeLimit, &memoryLimit)
	if err != nil {
		return err
	}
	resp := fiber.Map{
		"id":             problemID,
		"type":           typeStr,
		"title":          title,
		"tags":           decodeProblemTags(tagsJSON),
		"statementMd":    statement,
		"bodyJson":       json.RawMessage(bodyJSON),
		"timeLimitMs":    timeLimit,
		"memoryLimitMiB": memoryLimit,
	}
	return respondData(c, resp)
}
