package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"reflect"
	"strconv"
	"testing"
)

func TestSpaceAdminCreateProblemCreatesRootAndLink(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "space_admin_problem", "spaceadmin123")
	spaceID := mustCreateSpace(t, database, "Space-Problem-Create")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")

	cookie := mustLogin(t, app, "space_admin_problem", "spaceadmin123")
	resp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems", cookie, map[string]interface{}{
		"type":        "programming",
		"title":       "空间管理员上传题目",
		"statementMd": "请输出 Hello",
		"bodyJson": map[string]interface{}{
			"inputFormat":  "无",
			"outputFormat": "输出 Hello",
			"samples":      []map[string]string{{"input": "", "output": "Hello"}},
		},
		"answerJson": map[string]interface{}{},
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var env envelope[map[string]interface{}]
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	idVal, ok := env.Data["id"].(float64)
	if !ok || idVal <= 0 {
		t.Fatalf("invalid problem id in response: %+v", env.Data)
	}
	problemID := int64(idVal)

	var createdBy int64
	if err := database.QueryRow(`SELECT created_by FROM root_problems WHERE id=?`, problemID).Scan(&createdBy); err != nil {
		t.Fatalf("query root problem: %v", err)
	}
	if createdBy != spaceAdminID {
		t.Fatalf("expected created_by=%d, got %d", spaceAdminID, createdBy)
	}

	var count int
	if err := database.QueryRow(`SELECT COUNT(1) FROM space_problem_links WHERE space_id=? AND problem_id=?`, spaceID, problemID).Scan(&count); err != nil {
		t.Fatalf("query space link: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected linked problem in space, count=%d", count)
	}
}

func TestSpaceAdminCreateAndUpdateProblemTags(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "space_admin_problem_tags", "spaceadmintags123")
	spaceID := mustCreateSpace(t, database, "Space-Problem-Tags")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")

	cookie := mustLogin(t, app, "space_admin_problem_tags", "spaceadmintags123")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems", cookie, map[string]interface{}{
		"type":        "single_choice",
		"title":       "带标签的空间题",
		"tags":        []string{"语法", "入门", "语法"},
		"statementMd": "请选择答案",
		"bodyJson":    map[string]interface{}{"options": []string{"A", "B"}},
		"answerJson":  map[string]interface{}{"answer": "A"},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createResp.StatusCode)
	}
	createEnv := decodeEnvelope[map[string]interface{}](t, createResp)
	problemID := int64(createEnv.Data["id"].(float64))

	getResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/"+strconv.FormatInt(problemID, 10), cookie, nil)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected get 200, got %d", getResp.StatusCode)
	}
	getEnv := decodeEnvelope[map[string]interface{}](t, getResp)
	if !reflect.DeepEqual(interfaceSliceToStringSlice(t, getEnv.Data["tags"]), []string{"语法", "入门"}) {
		t.Fatalf("unexpected create tags: %+v", getEnv.Data["tags"])
	}

	updateResp := doJSONRequest(t, app, http.MethodPut, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/"+strconv.FormatInt(problemID, 10), cookie, map[string]interface{}{
		"type":        "single_choice",
		"title":       "带标签的空间题（更新）",
		"tags":        []string{"枚举", "模拟"},
		"statementMd": "请选择答案",
		"bodyJson":    map[string]interface{}{"options": []string{"A", "B"}},
		"answerJson":  map[string]interface{}{"answer": "A"},
	})
	if updateResp.StatusCode != http.StatusOK {
		t.Fatalf("expected update 200, got %d", updateResp.StatusCode)
	}
	updateResp.Body.Close()

	verifyResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/"+strconv.FormatInt(problemID, 10), cookie, nil)
	if verifyResp.StatusCode != http.StatusOK {
		t.Fatalf("expected verify 200, got %d", verifyResp.StatusCode)
	}
	verifyEnv := decodeEnvelope[map[string]interface{}](t, verifyResp)
	if !reflect.DeepEqual(interfaceSliceToStringSlice(t, verifyEnv.Data["tags"]), []string{"枚举", "模拟"}) {
		t.Fatalf("unexpected updated tags: %+v", verifyEnv.Data["tags"])
	}
}

func TestMemberCannotCreateSpaceProblem(t *testing.T) {
	app, database := newTestApp(t, false)

	memberID := seedUser(t, database, "space_member_problem", "member123")
	spaceID := mustCreateSpace(t, database, "Space-Problem-Member")
	mustAddMember(t, database, spaceID, memberID, "member")

	cookie := mustLogin(t, app, "space_member_problem", "member123")
	resp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems", cookie, map[string]interface{}{
		"type":        "single_choice",
		"title":       "无权限上传",
		"statementMd": "test",
		"bodyJson":    map[string]interface{}{"options": []string{"A", "B"}},
		"answerJson":  map[string]interface{}{"answer": "A"},
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func mustCreateSpace(t *testing.T, database *sql.DB, name string) int64 {
	t.Helper()
	res, err := database.Exec(`INSERT INTO spaces(name, description, created_by) VALUES(?, '', 1)`, name)
	if err != nil {
		t.Fatalf("create space: %v", err)
	}
	id, _ := res.LastInsertId()
	return id
}

func mustAddMember(t *testing.T, database *sql.DB, spaceID, userID int64, role string) {
	t.Helper()
	if _, err := database.Exec(`INSERT INTO space_members(space_id, user_id, role) VALUES(?, ?, ?)`, spaceID, userID, role); err != nil {
		t.Fatalf("add member: %v", err)
	}
}
