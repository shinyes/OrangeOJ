package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"orangeoj/backend/internal/auth"
	"orangeoj/backend/internal/db"

	"github.com/gofiber/fiber/v2"
)

type registrationRequest struct {
	Enabled bool `json:"enabled"`
}

type rootProblemPayload struct {
	Type           string          `json:"type"`
	Title          string          `json:"title"`
	StatementMD    string          `json:"statementMd"`
	BodyJSON       json.RawMessage `json:"bodyJson"`
	AnswerJSON     json.RawMessage `json:"answerJson"`
	TimeLimitMS    int             `json:"timeLimitMs"`
	MemoryLimitMiB int             `json:"memoryLimitMiB"`
}

type createSpacePayload struct {
	Name                       string `json:"name"`
	Description                string `json:"description"`
	AdminUserID                int64  `json:"adminUserId"`
	DefaultProgrammingLanguage string `json:"defaultProgrammingLanguage"`
}

type batchRegisterItemPayload struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type batchRegisterPayload struct {
	Items   []batchRegisterItemPayload `json:"items"`
	SpaceID *int64                     `json:"spaceId"`
}

func (a *API) handleGetRegistration(c *fiber.Ctx) error {
	enabled, err := db.GetRegistrationEnabled(c.Context(), a.DB)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"enabled": enabled})
}

func (a *API) handleSetRegistration(c *fiber.Ctx) error {
	var req registrationRequest
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	if err := db.SetRegistrationEnabled(c.Context(), a.DB, req.Enabled); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"enabled": req.Enabled})
}

func (a *API) handleListRootProblems(c *fiber.Ctx) error {
	rows, err := a.DB.Query(`
SELECT id, type, title, statement_md, body_json, answer_json, time_limit_ms, memory_limit_mib, created_by, created_at
FROM root_problems
ORDER BY id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var (
			id, timeLimit, memoryLimit, createdBy           int64
			typeStr, title, statement, bodyJSON, answerJSON string
			createdAt                                       time.Time
		)
		if err := rows.Scan(&id, &typeStr, &title, &statement, &bodyJSON, &answerJSON, &timeLimit, &memoryLimit, &createdBy, &createdAt); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":             id,
			"type":           typeStr,
			"title":          title,
			"statementMd":    statement,
			"bodyJson":       json.RawMessage(bodyJSON),
			"answerJson":     json.RawMessage(answerJSON),
			"timeLimitMs":    timeLimit,
			"memoryLimitMiB": memoryLimit,
			"createdBy":      createdBy,
			"createdAt":      createdAt,
		})
	}
	return respondData(c, items)
}

func (a *API) handleGetRootProblem(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid problem id")
	}
	row := a.DB.QueryRow(`
SELECT id, type, title, statement_md, body_json, answer_json, time_limit_ms, memory_limit_mib, created_by, created_at
FROM root_problems
WHERE id = ?`, id)
	var (
		idRet, timeLimit, memoryLimit, createdBy        int64
		typeStr, title, statement, bodyJSON, answerJSON string
		createdAt                                       time.Time
	)
	if err := row.Scan(&idRet, &typeStr, &title, &statement, &bodyJSON, &answerJSON, &timeLimit, &memoryLimit, &createdBy, &createdAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return respondError(c, fiber.StatusNotFound, "problem not found")
		}
		return err
	}
	return respondData(c, fiber.Map{
		"id":             idRet,
		"type":           typeStr,
		"title":          title,
		"statementMd":    statement,
		"bodyJson":       json.RawMessage(bodyJSON),
		"answerJson":     json.RawMessage(answerJSON),
		"timeLimitMs":    timeLimit,
		"memoryLimitMiB": memoryLimit,
		"createdBy":      createdBy,
		"createdAt":      createdAt,
	})
}

func (a *API) handleCreateRootProblem(c *fiber.Ctx) error {
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
	result, err := a.DB.Exec(`
INSERT INTO root_problems(type, title, statement_md, body_json, answer_json, time_limit_ms, memory_limit_mib, created_by)
VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, req.Type, req.Title, req.StatementMD, string(req.BodyJSON), string(req.AnswerJSON), req.TimeLimitMS, req.MemoryLimitMiB, user.ID)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	return respondData(c, fiber.Map{"id": id})
}

func (a *API) handleUpdateRootProblem(c *fiber.Ctx) error {
	problemID, err := parseIDParam(c, "id")
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
	_, err = a.DB.Exec(`
UPDATE root_problems
SET type=?, title=?, statement_md=?, body_json=?, answer_json=?, time_limit_ms=?, memory_limit_mib=?
WHERE id=?`, req.Type, req.Title, req.StatementMD, string(req.BodyJSON), string(req.AnswerJSON), req.TimeLimitMS, req.MemoryLimitMiB, problemID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": problemID})
}

func (a *API) handleDeleteRootProblem(c *fiber.Ctx) error {
	problemID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	_, err = a.DB.Exec(`DELETE FROM root_problems WHERE id=?`, problemID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"deleted": true})
}

func (a *API) handleAdminListSpaces(c *fiber.Ctx) error {
	rows, err := a.DB.Query(`
SELECT s.id, s.name, s.description, s.default_programming_language, s.created_by, s.created_at,
       (SELECT COUNT(1) FROM space_members sm WHERE sm.space_id=s.id) AS member_count,
       (SELECT COUNT(1) FROM space_problem_links l WHERE l.space_id=s.id) AS problem_count
FROM spaces s
ORDER BY s.id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	spaces := make([]fiber.Map, 0)
	for rows.Next() {
		var id, createdBy, memberCount, problemCount int64
		var name, description, defaultLanguage string
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &description, &defaultLanguage, &createdBy, &createdAt, &memberCount, &problemCount); err != nil {
			return err
		}
		spaces = append(spaces, fiber.Map{
			"id":                         id,
			"name":                       name,
			"description":                description,
			"defaultProgrammingLanguage": normalizeSpaceProgrammingLanguage(defaultLanguage),
			"createdBy":                  createdBy,
			"createdAt":                  createdAt,
			"memberCount":                memberCount,
			"problemCount":               problemCount,
		})
	}
	return respondData(c, spaces)
}

func (a *API) handleAdminCreateSpace(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	var req createSpacePayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return respondError(c, fiber.StatusBadRequest, "name required")
	}
	if req.DefaultProgrammingLanguage == "" {
		req.DefaultProgrammingLanguage = "cpp"
	}
	if !isValidSpaceProgrammingLanguage(req.DefaultProgrammingLanguage) {
		return respondError(c, fiber.StatusBadRequest, "invalid language")
	}
	if req.AdminUserID <= 0 {
		req.AdminUserID = user.ID
	}

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
INSERT INTO spaces(name, description, default_programming_language, created_by)
VALUES(?, ?, ?, ?)`, req.Name, req.Description, normalizeSpaceProgrammingLanguage(req.DefaultProgrammingLanguage), user.ID)
	if err != nil {
		if isUniqueErr(err) {
			return respondError(c, fiber.StatusConflict, "space name already exists")
		}
		return err
	}
	spaceID, _ := res.LastInsertId()
	if _, err := tx.Exec(`INSERT INTO space_members(space_id, user_id, role) VALUES(?, ?, 'space_admin')`, spaceID, req.AdminUserID); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"id": spaceID})
}

func (a *API) handleBatchRegisterUsers(c *fiber.Ctx) error {
	var req batchRegisterPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	if len(req.Items) == 0 || len(req.Items) > 200 {
		return respondError(c, fiber.StatusBadRequest, "items must contain 1 to 200 entries")
	}

	hasSpace := req.SpaceID != nil
	spaceID := int64(0)
	if hasSpace {
		spaceID = *req.SpaceID
		if spaceID <= 0 {
			return respondError(c, fiber.StatusBadRequest, "invalid spaceId")
		}
		var count int
		if err := a.DB.QueryRow(`SELECT COUNT(1) FROM spaces WHERE id=?`, spaceID).Scan(&count); err != nil {
			return err
		}
		if count == 0 {
			return respondError(c, fiber.StatusBadRequest, "invalid spaceId")
		}
	}

	results := make([]fiber.Map, 0, len(req.Items))
	successCount := 0

	for idx, item := range req.Items {
		username := strings.TrimSpace(item.Username)
		row := fiber.Map{
			"index":    idx + 1,
			"username": username,
			"success":  false,
		}

		if username == "" {
			row["reason"] = "invalid username"
			results = append(results, row)
			continue
		}
		if len(item.Password) < 6 {
			row["reason"] = "password must be at least 6 characters"
			results = append(results, row)
			continue
		}

		hashed, err := auth.HashPassword(item.Password)
		if err != nil {
			row["reason"] = "failed to process password"
			results = append(results, row)
			continue
		}

		tx, err := a.DB.BeginTx(c.Context(), nil)
		if err != nil {
			return err
		}

		res, err := tx.Exec(`INSERT INTO users(username, password_hash, global_role) VALUES(?, ?, 'user')`, username, hashed)
		if err != nil {
			_ = tx.Rollback()
			if isUniqueErr(err) {
				row["reason"] = "username already exists"
				results = append(results, row)
				continue
			}
			return err
		}
		userID, _ := res.LastInsertId()

		if hasSpace {
			_, err = tx.Exec(`
INSERT INTO space_members(space_id, user_id, role)
VALUES(?, ?, 'member')
ON CONFLICT(space_id, user_id) DO UPDATE SET role='member'`, spaceID, userID)
			if err != nil {
				_ = tx.Rollback()
				return err
			}
		}

		if err := tx.Commit(); err != nil {
			return err
		}

		successCount++
		row["success"] = true
		row["userId"] = userID
		results = append(results, row)
	}

	return respondData(c, fiber.Map{
		"total":        len(req.Items),
		"successCount": successCount,
		"failureCount": len(req.Items) - successCount,
		"results":      results,
	})
}
