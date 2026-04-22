package api

import (
	"database/sql"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"orangeoj/backend/internal/auth"
)

type API struct {
	DB           *sql.DB
	JWTSecret    string
	CookieSecure bool
}

func respondData(c *fiber.Ctx, data interface{}) error {
	return c.JSON(fiber.Map{"data": data})
}

func respondError(c *fiber.Ctx, code int, message string) error {
	return c.Status(code).JSON(fiber.Map{"error": message})
}

func getUser(c *fiber.Ctx) (auth.UserIdentity, error) {
	user, ok := auth.CurrentUser(c)
	if !ok {
		return auth.UserIdentity{}, fiber.NewError(fiber.StatusUnauthorized, "authentication required")
	}
	return user, nil
}

func parseIDParam(c *fiber.Ctx, name string) (int64, error) {
	raw := c.Params(name)
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, fiber.NewError(fiber.StatusBadRequest, "invalid "+name)
	}
	return id, nil
}

func (a *API) ensureSpaceReadable(spaceID, userID int64, globalRole string) error {
	if globalRole == "system_admin" {
		return nil
	}
	var count int
	err := a.DB.QueryRow(`SELECT COUNT(1) FROM space_members WHERE space_id=? AND user_id=?`, spaceID, userID).Scan(&count)
	if err != nil {
		return err
	}
	if count == 0 {
		return fiber.NewError(fiber.StatusForbidden, "space membership required")
	}
	return nil
}

func (a *API) isSpaceAdmin(spaceID, userID int64, globalRole string) (bool, error) {
	if globalRole == "system_admin" {
		return true, nil
	}
	return auth.IsSpaceAdmin(a.DB, spaceID, userID)
}

func scanNullString(ns sql.NullString) string {
	if !ns.Valid {
		return ""
	}
	return ns.String
}

func isUniqueErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique constraint failed")
}

func isForeignKeyErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "foreign key constraint failed")
}

func normalizeProblemType(problemType string) string {
	return strings.ToLower(strings.TrimSpace(problemType))
}

func isValidProblemType(problemType string) bool {
	switch normalizeProblemType(problemType) {
	case "programming", "single_choice", "true_false":
		return true
	default:
		return false
	}
}

func isValidLanguage(language string) bool {
	switch strings.ToLower(strings.TrimSpace(language)) {
	case "cpp", "c++", "python", "python3", "py", "go", "golang":
		return true
	default:
		return false
	}
}

func normalizeSpaceProgrammingLanguage(language string) string {
	switch strings.ToLower(strings.TrimSpace(language)) {
	case "python", "python3", "py":
		return "python"
	case "go", "golang":
		return "go"
	default:
		return "cpp"
	}
}

func isValidSpaceProgrammingLanguage(language string) bool {
	switch strings.ToLower(strings.TrimSpace(language)) {
	case "cpp", "c++", "python", "python3", "py", "go", "golang":
		return true
	default:
		return false
	}
}
