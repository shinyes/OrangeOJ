package auth

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const CookieName = "orangeoj_token"

type Claims struct {
	UserID     int64  `json:"uid"`
	Username   string `json:"username"`
	GlobalRole string `json:"role"`
	jwt.RegisteredClaims
}

type UserIdentity struct {
	ID         int64  `json:"id"`
	Username   string `json:"username"`
	GlobalRole string `json:"globalRole"`
}

func HashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func VerifyPassword(hashed, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(password)) == nil
}

func GenerateToken(secret string, identity UserIdentity) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:     identity.ID,
		Username:   identity.Username,
		GlobalRole: identity.GlobalRole,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
			Subject:   identity.Username,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(secret, tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.NewError(fiber.StatusUnauthorized, "unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func AuthMiddleware(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := strings.TrimSpace(c.Cookies(CookieName))
		if token == "" {
			authHeader := c.Get("Authorization")
			if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
				token = strings.TrimSpace(authHeader[7:])
			}
		}
		if token == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
		}
		claims, err := ParseToken(secret, token)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid token")
		}
		c.Locals("user", UserIdentity{
			ID:         claims.UserID,
			Username:   claims.Username,
			GlobalRole: claims.GlobalRole,
		})
		return c.Next()
	}
}

func CurrentUser(c *fiber.Ctx) (UserIdentity, bool) {
	user, ok := c.Locals("user").(UserIdentity)
	return user, ok
}

func RequireSystemAdmin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, ok := CurrentUser(c)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
		}
		if user.GlobalRole != "system_admin" {
			return fiber.NewError(fiber.StatusForbidden, "system admin required")
		}
		return c.Next()
	}
}

func IsSpaceAdmin(db *sql.DB, spaceID, userID int64) (bool, error) {
	var count int
	err := db.QueryRow(`SELECT COUNT(1) FROM space_members WHERE space_id=? AND user_id=? AND role='space_admin'`, spaceID, userID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func RequireSpaceAdmin(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, ok := CurrentUser(c)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
		}
		if user.GlobalRole == "system_admin" {
			return c.Next()
		}
		spaceID, err := c.ParamsInt("spaceId")
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid spaceId")
		}
		isAdmin, err := IsSpaceAdmin(db, int64(spaceID), user.ID)
		if err != nil {
			return err
		}
		if !isAdmin {
			return fiber.NewError(fiber.StatusForbidden, "space admin required")
		}
		return c.Next()
	}
}

func EnsureSpaceMember(db *sql.DB, spaceID, userID int64) (bool, error) {
	var count int
	err := db.QueryRow(`SELECT COUNT(1) FROM space_members WHERE space_id=? AND user_id=?`, spaceID, userID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
