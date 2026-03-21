package api

import (
	"net/http"
	"strconv"
	"testing"
)

func TestChangePasswordSuccess(t *testing.T) {
	app, _ := newTestApp(t, false)

	adminCookie := mustLogin(t, app, "admin", "admin123456")
	resp := doJSONRequest(t, app, http.MethodPost, "/api/auth/change-password", adminCookie, map[string]string{
		"oldPassword": "admin123456",
		"newPassword": "newpass123",
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	// old password should fail
	oldResp := doJSONRequest(t, app, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": "admin",
		"password": "admin123456",
	})
	defer oldResp.Body.Close()
	if oldResp.StatusCode == http.StatusOK {
		t.Fatalf("expected old password login to fail")
	}

	// new password should work
	newResp := doJSONRequest(t, app, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": "admin",
		"password": "newpass123",
	})
	defer newResp.Body.Close()
	if newResp.StatusCode != http.StatusOK {
		t.Fatalf("expected new password login success, got %d", newResp.StatusCode)
	}
}

func TestAdminResetAnyUserPassword(t *testing.T) {
	app, database := newTestApp(t, false)

	userID := seedUser(t, database, "alice_reset", "alice123")
	adminCookie := mustLogin(t, app, "admin", "admin123456")

	resp := doJSONRequest(t, app, http.MethodPost, "/api/admin/users/1/reset-password", adminCookie, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected reset self 200, got %d", resp.StatusCode)
	}

	resp = doJSONRequest(t, app, http.MethodPost, "/api/admin/users/"+itoa(userID)+"/reset-password", adminCookie, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected reset user 200, got %d", resp.StatusCode)
	}

	loginResp := doJSONRequest(t, app, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": "alice_reset",
		"password": "123456",
	})
	defer loginResp.Body.Close()
	if loginResp.StatusCode != http.StatusOK {
		t.Fatalf("expected login with reset password success, got %d", loginResp.StatusCode)
	}
}

func TestSpaceAdminResetPasswordScopeAndRestrictions(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "space_admin_1", "spaceadmin123")
	memberID := seedUser(t, database, "member_in_space", "member123")
	otherID := seedUser(t, database, "member_outside", "other123")

	res, err := database.Exec(`INSERT INTO spaces(name, description, created_by) VALUES('S-Reset', '', 1)`)
	if err != nil {
		t.Fatalf("create space: %v", err)
	}
	spaceID, _ := res.LastInsertId()

	if _, err := database.Exec(`INSERT INTO space_members(space_id, user_id, role) VALUES(?, ?, 'space_admin')`, spaceID, spaceAdminID); err != nil {
		t.Fatalf("insert space admin membership: %v", err)
	}
	if _, err := database.Exec(`INSERT INTO space_members(space_id, user_id, role) VALUES(?, ?, 'member')`, spaceID, memberID); err != nil {
		t.Fatalf("insert member membership: %v", err)
	}
	// put system admin into this space to verify restriction.
	if _, err := database.Exec(`INSERT INTO space_members(space_id, user_id, role) VALUES(?, 1, 'member')`, spaceID); err != nil {
		t.Fatalf("insert system admin membership: %v", err)
	}

	spaceAdminCookie := mustLogin(t, app, "space_admin_1", "spaceadmin123")

	resetResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/members/"+itoa(memberID)+"/reset-password", spaceAdminCookie, nil)
	defer resetResp.Body.Close()
	if resetResp.StatusCode != http.StatusOK {
		t.Fatalf("expected in-space reset success, got %d", resetResp.StatusCode)
	}

	loginResp := doJSONRequest(t, app, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": "member_in_space",
		"password": "123456",
	})
	defer loginResp.Body.Close()
	if loginResp.StatusCode != http.StatusOK {
		t.Fatalf("expected reset member to login with 123456, got %d", loginResp.StatusCode)
	}

	outsideResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/members/"+itoa(otherID)+"/reset-password", spaceAdminCookie, nil)
	defer outsideResp.Body.Close()
	if outsideResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected outside member reset 404, got %d", outsideResp.StatusCode)
	}

	sysAdminResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/members/1/reset-password", spaceAdminCookie, nil)
	defer sysAdminResp.Body.Close()
	if sysAdminResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected system admin reset forbidden for space admin, got %d", sysAdminResp.StatusCode)
	}
}

func itoa(v int64) string {
	return strconv.FormatInt(v, 10)
}
