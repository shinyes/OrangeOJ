package api

import (
	"database/sql"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"orangeoj/backend/internal/auth"
	"orangeoj/backend/internal/db"
)

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type registerRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (a *API) handleRegistrationStatus(c *fiber.Ctx) error {
	enabled, err := db.GetRegistrationEnabled(c.Context(), a.DB)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"enabled": enabled})
}

func (a *API) handleLogin(c *fiber.Ctx) error {
	var req loginRequest
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		return respondError(c, fiber.StatusBadRequest, "username and password required")
	}

	var id int64
	var username, passwordHash, globalRole string
	err := a.DB.QueryRow(`SELECT id, username, password_hash, global_role FROM users WHERE username=?`, req.Username).
		Scan(&id, &username, &passwordHash, &globalRole)
	if err == sql.ErrNoRows {
		return respondError(c, fiber.StatusUnauthorized, "invalid credentials")
	}
	if err != nil {
		return err
	}
	if !auth.VerifyPassword(passwordHash, req.Password) {
		return respondError(c, fiber.StatusUnauthorized, "invalid credentials")
	}

	token, err := auth.GenerateToken(a.JWTSecret, auth.UserIdentity{ID: id, Username: username, GlobalRole: globalRole})
	if err != nil {
		return err
	}
	c.Cookie(&fiber.Cookie{
		Name:     auth.CookieName,
		Value:    token,
		HTTPOnly: true,
		SameSite: "Lax",
		Secure:   a.CookieSecure,
		Path:     "/",
		Expires:  time.Now().Add(7 * 24 * time.Hour),
	})
	return respondData(c, fiber.Map{"id": id, "username": username, "globalRole": globalRole})
}

func (a *API) handleLogout(c *fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     auth.CookieName,
		Value:    "",
		HTTPOnly: true,
		SameSite: "Lax",
		Secure:   a.CookieSecure,
		Path:     "/",
		Expires:  time.Now().Add(-time.Hour),
	})
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleRegister(c *fiber.Ctx) error {
	enabled, err := db.GetRegistrationEnabled(c.Context(), a.DB)
	if err != nil {
		return err
	}
	if !enabled {
		return respondError(c, fiber.StatusForbidden, "registration is disabled")
	}

	var req registerRequest
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || len(req.Password) < 6 {
		return respondError(c, fiber.StatusBadRequest, "invalid username or password")
	}
	hashed, err := auth.HashPassword(req.Password)
	if err != nil {
		return err
	}
	result, err := a.DB.Exec(`INSERT INTO users(username, password_hash, global_role) VALUES(?, ?, 'user')`, req.Username, hashed)
	if err != nil {
		if isUniqueErr(err) {
			return respondError(c, fiber.StatusConflict, "username already exists")
		}
		return err
	}
	id, _ := result.LastInsertId()
	return respondData(c, fiber.Map{"id": id, "username": req.Username, "globalRole": "user"})
}

func (a *API) handleMe(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	return respondData(c, user)
}
