package api

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"orangeoj/backend/internal/auth"
)

const defaultResetPassword = "123456"

type changePasswordRequest struct {
	OldPassword string `json:"oldPassword"`
	NewPassword string `json:"newPassword"`
}

func (a *API) handleChangePassword(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}

	var req changePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.OldPassword = strings.TrimSpace(req.OldPassword)
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	if req.OldPassword == "" || req.NewPassword == "" {
		return respondError(c, fiber.StatusBadRequest, "oldPassword and newPassword required")
	}
	if len(req.NewPassword) < 6 {
		return respondError(c, fiber.StatusBadRequest, "new password must be at least 6 characters")
	}

	var currentHash string
	err = a.DB.QueryRow(`SELECT password_hash FROM users WHERE id=?`, user.ID).Scan(&currentHash)
	if errors.Is(err, sql.ErrNoRows) {
		return respondError(c, fiber.StatusNotFound, "user not found")
	}
	if err != nil {
		return err
	}
	if !auth.VerifyPassword(currentHash, req.OldPassword) {
		return respondError(c, fiber.StatusBadRequest, "old password incorrect")
	}

	hashed, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		return err
	}
	if _, err := a.DB.Exec(`UPDATE users SET password_hash=? WHERE id=?`, hashed, user.ID); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleAdminResetUserPassword(c *fiber.Ctx) error {
	targetUserID, err := parseIDParam(c, "userId")
	if err != nil {
		return err
	}
	if err := a.resetUserPasswordByID(targetUserID); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true, "userId": targetUserID, "resetTo": defaultResetPassword})
}

func (a *API) handleSpaceMemberResetPassword(c *fiber.Ctx) error {
	operator, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	targetUserID, err := parseIDParam(c, "userId")
	if err != nil {
		return err
	}

	var memberCount int
	if err := a.DB.QueryRow(`SELECT COUNT(1) FROM space_members WHERE space_id=? AND user_id=?`, spaceID, targetUserID).Scan(&memberCount); err != nil {
		return err
	}
	if memberCount == 0 {
		return respondError(c, fiber.StatusNotFound, "user is not in this space")
	}

	if operator.GlobalRole != "system_admin" {
		var targetGlobalRole string
		err := a.DB.QueryRow(`SELECT global_role FROM users WHERE id=?`, targetUserID).Scan(&targetGlobalRole)
		if errors.Is(err, sql.ErrNoRows) {
			return respondError(c, fiber.StatusNotFound, "user not found")
		}
		if err != nil {
			return err
		}
		if targetGlobalRole == "system_admin" {
			return respondError(c, fiber.StatusForbidden, "cannot reset system admin password")
		}
	}

	if err := a.resetUserPasswordByID(targetUserID); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true, "userId": targetUserID, "resetTo": defaultResetPassword})
}

func (a *API) resetUserPasswordByID(userID int64) error {
	hashed, err := auth.HashPassword(defaultResetPassword)
	if err != nil {
		return err
	}
	res, err := a.DB.Exec(`UPDATE users SET password_hash=? WHERE id=?`, hashed, userID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return fiber.NewError(fiber.StatusNotFound, "user not found")
	}
	return nil
}
