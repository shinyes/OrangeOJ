package api

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"
)

func TestRootProblemCreateAndUpdateTags(t *testing.T) {
	app, database := newTestApp(t, false)
	adminCookie := mustLogin(t, app, "admin", "admin123456")

	createResp := doJSONRequest(t, app, http.MethodPost, "/api/admin/root-problems", adminCookie, map[string]interface{}{
		"type":        "programming",
		"title":       "带标签的根题",
		"tags":        []string{"动态规划", "入门", "动态规划", " "},
		"statementMd": "题面",
		"bodyJson":    map[string]interface{}{},
		"answerJson":  map[string]interface{}{},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createResp.StatusCode)
	}
	createEnv := decodeEnvelope[map[string]int64](t, createResp)
	problemID := createEnv.Data["id"]
	if problemID <= 0 {
		t.Fatalf("invalid problem id: %+v", createEnv.Data)
	}

	var tagsJSON string
	if err := database.QueryRow(`SELECT tags_json FROM root_problems WHERE id=?`, problemID).Scan(&tagsJSON); err != nil {
		t.Fatalf("query tags_json: %v", err)
	}
	var storedTags []string
	if err := json.Unmarshal([]byte(tagsJSON), &storedTags); err != nil {
		t.Fatalf("decode tags_json: %v", err)
	}
	if !reflect.DeepEqual(storedTags, []string{"动态规划", "入门"}) {
		t.Fatalf("unexpected stored tags: %+v", storedTags)
	}

	getResp := doJSONRequest(t, app, http.MethodGet, "/api/admin/root-problems/"+itoa(problemID), adminCookie, nil)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected get 200, got %d", getResp.StatusCode)
	}
	getEnv := decodeEnvelope[map[string]interface{}](t, getResp)
	if !reflect.DeepEqual(interfaceSliceToStringSlice(t, getEnv.Data["tags"]), []string{"动态规划", "入门"}) {
		t.Fatalf("unexpected response tags: %+v", getEnv.Data["tags"])
	}

	updateResp := doJSONRequest(t, app, http.MethodPut, "/api/admin/root-problems/"+itoa(problemID), adminCookie, map[string]interface{}{
		"type":        "programming",
		"title":       "带标签的根题（更新）",
		"tags":        []string{"字符串", "模拟"},
		"statementMd": "更新题面",
		"bodyJson":    map[string]interface{}{},
		"answerJson":  map[string]interface{}{},
	})
	if updateResp.StatusCode != http.StatusOK {
		t.Fatalf("expected update 200, got %d", updateResp.StatusCode)
	}
	updateResp.Body.Close()

	verifyResp := doJSONRequest(t, app, http.MethodGet, "/api/admin/root-problems/"+itoa(problemID), adminCookie, nil)
	if verifyResp.StatusCode != http.StatusOK {
		t.Fatalf("expected verify 200, got %d", verifyResp.StatusCode)
	}
	verifyEnv := decodeEnvelope[map[string]interface{}](t, verifyResp)
	if !reflect.DeepEqual(interfaceSliceToStringSlice(t, verifyEnv.Data["tags"]), []string{"字符串", "模拟"}) {
		t.Fatalf("unexpected updated response tags: %+v", verifyEnv.Data["tags"])
	}
}

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

func interfaceSliceToStringSlice(t *testing.T, value interface{}) []string {
	t.Helper()
	items, ok := value.([]interface{})
	if !ok {
		t.Fatalf("expected []interface{}, got %T", value)
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		text, ok := item.(string)
		if !ok {
			t.Fatalf("expected string item, got %T", item)
		}
		result = append(result, text)
	}
	return result
}
