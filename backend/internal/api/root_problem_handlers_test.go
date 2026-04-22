package api

import (
	"net/http"
	"testing"
)

func TestDeleteRootProblemSuccess(t *testing.T) {
	app, database := newTestApp(t, false)
	adminCookie := mustLogin(t, app, "admin", "admin123456")

	res, err := database.Exec(`
INSERT INTO root_problems(type, title, statement_md, body_json, answer_json, created_by)
VALUES('programming', 'delete-me', 'statement', '{}', '{}', 1)`)
	if err != nil {
		t.Fatalf("seed root problem: %v", err)
	}
	problemID, _ := res.LastInsertId()

	resp := doJSONRequest(t, app, http.MethodDelete, "/api/admin/root-problems/"+itoa(problemID), adminCookie, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var count int
	if err := database.QueryRow(`SELECT COUNT(1) FROM root_problems WHERE id=?`, problemID).Scan(&count); err != nil {
		t.Fatalf("query problem count: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected problem deleted, count=%d", count)
	}
}

func TestDeleteRootProblemBlockedWhenReferenced(t *testing.T) {
	app, database := newTestApp(t, false)
	adminCookie := mustLogin(t, app, "admin", "admin123456")

	spaceID := mustCreateSpace(t, database, "Delete-Blocked-Space")

	res, err := database.Exec(`
INSERT INTO root_problems(type, title, statement_md, body_json, answer_json, created_by)
VALUES('programming', 'blocked-problem', 'statement', '{}', '{}', 1)`)
	if err != nil {
		t.Fatalf("seed root problem: %v", err)
	}
	problemID, _ := res.LastInsertId()

	if _, err := database.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, submit_type, status)
VALUES(1, ?, ?, 'programming', 'submit', 'done')`, spaceID, problemID); err != nil {
		t.Fatalf("seed submission: %v", err)
	}

	resp := doJSONRequest(t, app, http.MethodDelete, "/api/admin/root-problems/"+itoa(problemID), adminCookie, nil)
	result := decodeEnvelope[map[string]interface{}](t, resp)
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", resp.StatusCode)
	}
	if result.Error != "problem is still referenced" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
}
