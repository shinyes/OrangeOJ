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

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
INSERT INTO root_problems(type, title, statement_md, body_json, answer_json, time_limit_ms, memory_limit_mib, created_by)
VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, req.Type, req.Title, req.StatementMD, string(req.BodyJSON), string(req.AnswerJSON), req.TimeLimitMS, req.MemoryLimitMiB, user.ID)
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
SELECT s.id, s.name, s.description, s.created_by, s.created_at,
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
		var name, description, myRole string
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &description, &createdBy, &createdAt, &myRole); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":          id,
			"name":        name,
			"description": description,
			"createdBy":   createdBy,
			"createdAt":   createdAt,
			"myRole":      myRole,
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
	var name, description string
	var createdAt time.Time
	if err := a.DB.QueryRow(`SELECT id, name, description, created_by, created_at FROM spaces WHERE id=?`, spaceID).
		Scan(&id, &name, &description, &createdBy, &createdAt); err != nil {
		return err
	}
	return respondData(c, fiber.Map{
		"id":          id,
		"name":        name,
		"description": description,
		"createdBy":   createdBy,
		"createdAt":   createdAt,
	})
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
SELECT p.id, p.type, p.title, p.statement_md, p.time_limit_ms, p.memory_limit_mib
FROM space_problem_links l
JOIN root_problems p ON p.id = l.problem_id
WHERE l.space_id=?
ORDER BY p.id DESC`, spaceID)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id, timeLimit, memoryLimit int64
		var typeStr, title, statement string
		if err := rows.Scan(&id, &typeStr, &title, &statement, &timeLimit, &memoryLimit); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":             id,
			"type":           typeStr,
			"title":          title,
			"statementMd":    statement,
			"timeLimitMs":    timeLimit,
			"memoryLimitMiB": memoryLimit,
		})
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
		typeStr, title, statement, bodyJSON string
		timeLimit, memoryLimit              int64
	)
	err = a.DB.QueryRow(`
SELECT type, title, statement_md, body_json, time_limit_ms, memory_limit_mib
FROM root_problems WHERE id=?`, problemID).Scan(&typeStr, &title, &statement, &bodyJSON, &timeLimit, &memoryLimit)
	if err != nil {
		return err
	}
	resp := fiber.Map{
		"id":             problemID,
		"type":           typeStr,
		"title":          title,
		"statementMd":    statement,
		"bodyJson":       json.RawMessage(bodyJSON),
		"timeLimitMs":    timeLimit,
		"memoryLimitMiB": memoryLimit,
	}
	return respondData(c, resp)
}
