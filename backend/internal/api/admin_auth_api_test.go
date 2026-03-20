package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"orangeoj/backend/internal/auth"
	dbpkg "orangeoj/backend/internal/db"
)

type envelope[T any] struct {
	Data  T      `json:"data"`
	Error string `json:"error"`
}

type registrationStatusData struct {
	Enabled bool `json:"enabled"`
}

type batchRegisterData struct {
	Total        int                 `json:"total"`
	SuccessCount int                 `json:"successCount"`
	FailureCount int                 `json:"failureCount"`
	Results      []batchRegisterItem `json:"results"`
}

type batchRegisterItem struct {
	Index    int    `json:"index"`
	Username string `json:"username"`
	Success  bool   `json:"success"`
	UserID   int64  `json:"userId"`
	Reason   string `json:"reason"`
}

func TestRegistrationStatusEndpoint(t *testing.T) {
	app, database := newTestApp(t, false)

	resp := doJSONRequest(t, app, http.MethodGet, "/api/auth/registration-status", "", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	result := decodeEnvelope[registrationStatusData](t, resp)
	if result.Data.Enabled {
		t.Fatalf("expected registration disabled by default")
	}

	if err := dbpkg.SetRegistrationEnabled(context.Background(), database, true); err != nil {
		t.Fatalf("set registration enabled: %v", err)
	}

	resp = doJSONRequest(t, app, http.MethodGet, "/api/auth/registration-status", "", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 after update, got %d", resp.StatusCode)
	}
	result = decodeEnvelope[registrationStatusData](t, resp)
	if !result.Data.Enabled {
		t.Fatalf("expected registration enabled")
	}
}

func TestBatchRegisterUsersRequiresSystemAdmin(t *testing.T) {
	app, database := newTestApp(t, false)
	seedUser(t, database, "member1", "member123")
	cookie := mustLogin(t, app, "member1", "member123")

	payload := map[string]interface{}{
		"items": []map[string]string{
			{"username": "u1", "password": "passwd1"},
		},
	}
	resp := doJSONRequest(t, app, http.MethodPost, "/api/admin/users/batch-register", cookie, payload)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestBatchRegisterUsersPartialSuccessWithSpaceAssignment(t *testing.T) {
	app, database := newTestApp(t, false)
	adminCookie := mustLogin(t, app, "admin", "admin123456")

	spaceRes, err := database.Exec(`INSERT INTO spaces(name, description, created_by) VALUES('Class A', '', 1)`)
	if err != nil {
		t.Fatalf("create space: %v", err)
	}
	spaceID, _ := spaceRes.LastInsertId()

	payload := map[string]interface{}{
		"items": []map[string]string{
			{"username": "alice", "password": "alice123"},
			{"username": " ", "password": "abc123"},
			{"username": "admin", "password": "admin123"},
			{"username": "bob", "password": "123"},
			{"username": "carol", "password": "carol123"},
		},
		"spaceId": spaceID,
	}
	resp := doJSONRequest(t, app, http.MethodPost, "/api/admin/users/batch-register", adminCookie, payload)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	result := decodeEnvelope[batchRegisterData](t, resp)
	if result.Data.Total != 5 || result.Data.SuccessCount != 2 || result.Data.FailureCount != 3 {
		t.Fatalf("unexpected counters: %+v", result.Data)
	}

	successUsers := map[string]int64{}
	for _, row := range result.Data.Results {
		if row.Success {
			successUsers[row.Username] = row.UserID
		}
	}
	if len(successUsers) != 2 {
		t.Fatalf("expected 2 successful users, got %d", len(successUsers))
	}

	for _, username := range []string{"alice", "carol"} {
		userID := successUsers[username]
		if userID <= 0 {
			t.Fatalf("expected userId for %s", username)
		}
		var role string
		err := database.QueryRow(`SELECT role FROM space_members WHERE space_id=? AND user_id=?`, spaceID, userID).Scan(&role)
		if err != nil {
			t.Fatalf("space member for %s: %v", username, err)
		}
		if role != "member" {
			t.Fatalf("expected role member for %s, got %s", username, role)
		}
	}
}

func TestBatchRegisterUsersInvalidSpaceRejectsAll(t *testing.T) {
	app, database := newTestApp(t, false)
	adminCookie := mustLogin(t, app, "admin", "admin123456")

	payload := map[string]interface{}{
		"items": []map[string]string{
			{"username": "new_user_1", "password": "passwd1"},
		},
		"spaceId": 99999,
	}
	resp := doJSONRequest(t, app, http.MethodPost, "/api/admin/users/batch-register", adminCookie, payload)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}

	var count int
	if err := database.QueryRow(`SELECT COUNT(1) FROM users WHERE username='new_user_1'`).Scan(&count); err != nil {
		t.Fatalf("query user: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected user not created when space is invalid")
	}
}

func TestBatchRegisterUsersTooManyItems(t *testing.T) {
	app, _ := newTestApp(t, false)
	adminCookie := mustLogin(t, app, "admin", "admin123456")

	items := make([]map[string]string, 0, 201)
	for i := 0; i < 201; i++ {
		items = append(items, map[string]string{
			"username": fmt.Sprintf("u_%03d", i),
			"password": "passwd1",
		})
	}

	payload := map[string]interface{}{"items": items}
	resp := doJSONRequest(t, app, http.MethodPost, "/api/admin/users/batch-register", adminCookie, payload)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func newTestApp(t *testing.T, registrationDefault bool) (*fiber.App, *sql.DB) {
	t.Helper()
	database, err := dbpkg.Open(t.TempDir() + "/api-test.db")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() {
		_ = database.Close()
	})

	if _, err := dbpkg.Setup(context.Background(), database, registrationDefault, "admin123456"); err != nil {
		t.Fatalf("setup db: %v", err)
	}
	return NewApp(database, "test-secret", false, ""), database
}

func seedUser(t *testing.T, database *sql.DB, username, password string) int64 {
	t.Helper()
	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	res, err := database.Exec(`INSERT INTO users(username, password_hash, global_role) VALUES(?, ?, 'user')`, username, hash)
	if err != nil {
		t.Fatalf("seed user %s: %v", username, err)
	}
	id, _ := res.LastInsertId()
	return id
}

func mustLogin(t *testing.T, app *fiber.App, username, password string) string {
	t.Helper()
	resp := doJSONRequest(t, app, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": username,
		"password": password,
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login failed for %s: %d", username, resp.StatusCode)
	}
	for _, cookie := range resp.Cookies() {
		if cookie.Name == auth.CookieName {
			return cookie.Name + "=" + cookie.Value
		}
	}
	t.Fatalf("auth cookie missing in login response")
	return ""
}

func doJSONRequest(t *testing.T, app *fiber.App, method, path, cookie string, body interface{}) *http.Response {
	t.Helper()
	var reqBody []byte
	var err error
	if body != nil {
		reqBody, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("request %s %s failed: %v", method, path, err)
	}
	return resp
}

func decodeEnvelope[T any](t *testing.T, resp *http.Response) envelope[T] {
	t.Helper()
	defer resp.Body.Close()
	var out envelope[T]
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return out
}
