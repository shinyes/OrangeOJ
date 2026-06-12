package api

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
)

func (a *API) handleGetProblemDraft(c *fiber.Ctx) error {
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
	if err := a.ensureProblemInSpace(spaceID, problemID); err != nil {
		return err
	}

	var draftJSON string
	var updatedAt string
	err = a.DB.QueryRow(`
	SELECT draft_json, updated_at
	FROM problem_drafts
	WHERE user_id=? AND space_id=? AND problem_id=?`, user.ID, spaceID, problemID).Scan(&draftJSON, &updatedAt)
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

func (a *API) handleSaveProblemDraft(c *fiber.Ctx) error {
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
	if err := a.ensureProblemInSpace(spaceID, problemID); err != nil {
		return err
	}

	var req struct {
		Draft string `json:"draft"`
	}
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	_, err = a.DB.Exec(`
	INSERT INTO problem_drafts(user_id, space_id, problem_id, draft_json, updated_at)
	VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP)
	ON CONFLICT(user_id, space_id, problem_id)
	DO UPDATE SET draft_json=excluded.draft_json, updated_at=CURRENT_TIMESTAMP`,
		user.ID, spaceID, problemID, req.Draft)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleDeleteProblemDraft(c *fiber.Ctx) error {
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
	_, err = a.DB.Exec(`
	DELETE FROM problem_drafts
	WHERE user_id=? AND space_id=? AND problem_id=?`,
		user.ID, spaceID, problemID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}
