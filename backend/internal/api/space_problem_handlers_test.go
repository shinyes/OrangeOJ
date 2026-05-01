package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"reflect"
	"strconv"
	"testing"
)

func TestSpaceAdminCreateProblemCreatesSpaceOwnedProblem(t *testing.T) {
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

	var createdBy, storedSpaceID int64
	if err := database.QueryRow(`SELECT created_by, space_id FROM space_problems WHERE id=?`, problemID).Scan(&createdBy, &storedSpaceID); err != nil {
		t.Fatalf("query problem: %v", err)
	}
	if createdBy != spaceAdminID {
		t.Fatalf("expected created_by=%d, got %d", spaceAdminID, createdBy)
	}
	if storedSpaceID != spaceID {
		t.Fatalf("expected space_id=%d, got %d", spaceID, storedSpaceID)
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

func TestCreateSpaceProblemNormalizesSingleChoiceAnswerIndex(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "space_problem_answer_index_admin", "spaceanswerindex123")
	spaceID := mustCreateSpace(t, database, "Space-Problem-Answer-Index")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")

	cookie := mustLogin(t, app, "space_problem_answer_index_admin", "spaceanswerindex123")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems", cookie, map[string]interface{}{
		"type":        "single_choice",
		"title":       "索引答案单选题",
		"statementMd": "请选择正确答案",
		"bodyJson":    map[string]interface{}{"options": []string{"A1", "B2", "C3", "D4"}},
		"answerJson":  map[string]interface{}{"correctIndex": 2},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createResp.StatusCode)
	}
	createEnv := decodeEnvelope[map[string]interface{}](t, createResp)
	problemID := int64(createEnv.Data["id"].(float64))

	var storedAnswerJSON string
	if err := database.QueryRow(`SELECT answer_json FROM space_problems WHERE id=?`, problemID).Scan(&storedAnswerJSON); err != nil {
		t.Fatalf("query answer json: %v", err)
	}
	var storedAnswer map[string]interface{}
	if err := json.Unmarshal([]byte(storedAnswerJSON), &storedAnswer); err != nil {
		t.Fatalf("decode stored answer json: %v", err)
	}
	if storedAnswer["answer"] != "C3" {
		t.Fatalf("expected stored answer C3, got %+v", storedAnswer)
	}

	getResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/"+strconv.FormatInt(problemID, 10)+"?includeAnswer=1", cookie, nil)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected get 200, got %d", getResp.StatusCode)
	}
	getEnv := decodeEnvelope[map[string]interface{}](t, getResp)
	answerJSON, ok := getEnv.Data["answerJson"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected answerJson in response, got %+v", getEnv.Data["answerJson"])
	}
	if answerJSON["answer"] != "C3" {
		t.Fatalf("expected response answer C3, got %+v", answerJSON)
	}
}

func TestGetSpaceProblemIncludeAnswerRequiresSpaceAdmin(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "space_problem_detail_admin", "spaceproblemdetail123")
	memberID := seedUser(t, database, "space_problem_detail_member", "spaceproblemdetailmember123")
	spaceID := mustCreateSpace(t, database, "Space-Problem-Detail")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberID, "member")

	cookie := mustLogin(t, app, "space_problem_detail_admin", "spaceproblemdetail123")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems", cookie, map[string]interface{}{
		"type":        "single_choice",
		"title":       "带答案的单选题",
		"statementMd": "请选择正确答案",
		"bodyJson":    map[string]interface{}{"options": []string{"A1", "B2", "C3", "D4"}},
		"answerJson":  map[string]interface{}{"answer": "C3"},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createResp.StatusCode)
	}
	createEnv := decodeEnvelope[map[string]interface{}](t, createResp)
	problemID := int64(createEnv.Data["id"].(float64))

	memberCookie := mustLogin(t, app, "space_problem_detail_member", "spaceproblemdetailmember123")
	memberGetResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/"+strconv.FormatInt(problemID, 10), memberCookie, nil)
	if memberGetResp.StatusCode != http.StatusOK {
		t.Fatalf("expected member get 200, got %d", memberGetResp.StatusCode)
	}
	memberEnv := decodeEnvelope[map[string]interface{}](t, memberGetResp)
	if _, ok := memberEnv.Data["answerJson"]; ok {
		t.Fatalf("member should not receive answerJson: %+v", memberEnv.Data)
	}

	memberGetWithAnswerResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/"+strconv.FormatInt(problemID, 10)+"?includeAnswer=1", memberCookie, nil)
	defer memberGetWithAnswerResp.Body.Close()
	if memberGetWithAnswerResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected member includeAnswer get 403, got %d", memberGetWithAnswerResp.StatusCode)
	}

	adminGetResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/"+strconv.FormatInt(problemID, 10)+"?includeAnswer=1", cookie, nil)
	if adminGetResp.StatusCode != http.StatusOK {
		t.Fatalf("expected admin includeAnswer get 200, got %d", adminGetResp.StatusCode)
	}
	adminEnv := decodeEnvelope[map[string]interface{}](t, adminGetResp)
	answerJSON, ok := adminEnv.Data["answerJson"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected answerJson in admin response, got %+v", adminEnv.Data["answerJson"])
	}
	if answerJSON["answer"] != "C3" {
		t.Fatalf("expected answer C3, got %+v", answerJSON)
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

func TestListSpaceProblemsIncludesCompletionState(t *testing.T) {
	app, database := newTestApp(t, false)

	memberID := seedUser(t, database, "space_problem_progress_member", "spaceproblemprogress123")
	spaceID := mustCreateSpace(t, database, "Space-Problem-Progress")
	mustAddMember(t, database, spaceID, memberID, "member")

	problemID1 := mustCreateSpaceProblem(t, database, "已完成题目")
	problemID2 := mustCreateSpaceProblem(t, database, "未完成题目")

	submissionRes, err := database.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict, score, stdout, stderr, finished_at)
VALUES(?, ?, ?, 'programming', 'cpp', 'int main(){return 0;}', '', 'submit', 'done', 'AC', 100, '', '', CURRENT_TIMESTAMP)`,
		memberID, spaceID, problemID1,
	)
	if err != nil {
		t.Fatalf("create submission: %v", err)
	}
	submissionID, _ := submissionRes.LastInsertId()
	if _, err := database.Exec(`
INSERT INTO user_problem_progress(space_id, user_id, problem_id, best_verdict, best_score, last_submission_id)
VALUES(?, ?, ?, 'AC', 100, ?)`,
		spaceID, memberID, problemID1, submissionID,
	); err != nil {
		t.Fatalf("create progress: %v", err)
	}

	cookie := mustLogin(t, app, "space_problem_progress_member", "spaceproblemprogress123")
	resp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems", cookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected list 200, got %d", resp.StatusCode)
	}
	items := decodeEnvelope[[]map[string]interface{}](t, resp).Data
	if len(items) != 2 {
		t.Fatalf("expected 2 problems, got %d", len(items))
	}

	completedByID := map[int64]bool{}
	for _, item := range items {
		id, _ := item["id"].(float64)
		completed, _ := item["completed"].(bool)
		completedByID[int64(id)] = completed
	}
	if completedByID[problemID1] != true {
		t.Fatalf("expected problem %d completed=true, got %+v", problemID1, completedByID)
	}
	if completedByID[problemID2] != false {
		t.Fatalf("expected problem %d completed=false, got %+v", problemID2, completedByID)
	}
}

func TestDeleteSpaceProblemAllowsExistingSubmissions(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "space_problem_delete_admin", "spaceproblemdelete123")
	memberID := seedUser(t, database, "space_problem_delete_member", "spaceproblemdeletemember123")
	spaceID := mustCreateSpace(t, database, "Space-Problem-Delete")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberID, "member")
	problemID := mustCreateSpaceProblem(t, database, "允许带提交删除的题目")

	submissionRes, err := database.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict, score, stdout, stderr, finished_at)
VALUES(?, ?, ?, 'programming', 'cpp', 'int main(){return 0;}', '', 'submit', 'done', 'AC', 100, '', '', CURRENT_TIMESTAMP)`,
		memberID, spaceID, problemID,
	)
	if err != nil {
		t.Fatalf("create submission: %v", err)
	}
	submissionID, _ := submissionRes.LastInsertId()
	if _, err := database.Exec(`
INSERT INTO user_problem_progress(space_id, user_id, problem_id, best_verdict, best_score, last_submission_id)
VALUES(?, ?, ?, 'AC', 100, ?)`,
		spaceID, memberID, problemID, submissionID,
	); err != nil {
		t.Fatalf("create progress: %v", err)
	}

	cookie := mustLogin(t, app, "space_problem_delete_admin", "spaceproblemdelete123")
	resp := doJSONRequest(t, app, http.MethodDelete, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/"+strconv.FormatInt(problemID, 10), cookie, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected delete 200, got %d", resp.StatusCode)
	}

	var remainingProblems int
	if err := database.QueryRow(`SELECT COUNT(1) FROM space_problems WHERE id=? AND space_id=?`, problemID, spaceID).Scan(&remainingProblems); err != nil {
		t.Fatalf("count problems: %v", err)
	}
	if remainingProblems != 0 {
		t.Fatalf("expected problem to be deleted, got %d rows", remainingProblems)
	}

	var remainingSubmissions int
	if err := database.QueryRow(`SELECT COUNT(1) FROM submissions WHERE problem_id=? AND space_id=?`, problemID, spaceID).Scan(&remainingSubmissions); err != nil {
		t.Fatalf("count submissions: %v", err)
	}
	if remainingSubmissions != 0 {
		t.Fatalf("expected submissions to be deleted, got %d rows", remainingSubmissions)
	}

	var remainingProgress int
	if err := database.QueryRow(`SELECT COUNT(1) FROM user_problem_progress WHERE problem_id=? AND space_id=?`, problemID, spaceID).Scan(&remainingProgress); err != nil {
		t.Fatalf("count progress: %v", err)
	}
	if remainingProgress != 0 {
		t.Fatalf("expected progress to be deleted, got %d rows", remainingProgress)
	}
}

func TestDeleteSpaceProblemStillBlockedByHomeworkReference(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "space_problem_delete_homework_admin", "spaceproblemhomework123")
	spaceID := mustCreateSpace(t, database, "Space-Problem-Delete-Homework")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	problemID := mustCreateSpaceProblem(t, database, "仍被作业引用的题目")

	homeworkRes, err := database.Exec(`
INSERT INTO homeworks(space_id, title, description, created_by, published)
VALUES(?, '删除阻塞作业', '', ?, 1)`, spaceID, spaceAdminID)
	if err != nil {
		t.Fatalf("create homework: %v", err)
	}
	homeworkID, _ := homeworkRes.LastInsertId()
	if _, err := database.Exec(`
INSERT INTO homework_items(homework_id, problem_id, order_no, score)
VALUES(?, ?, 1, 100)`, homeworkID, problemID); err != nil {
		t.Fatalf("create homework item: %v", err)
	}

	cookie := mustLogin(t, app, "space_problem_delete_homework_admin", "spaceproblemhomework123")
	resp := doJSONRequest(t, app, http.MethodDelete, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/"+strconv.FormatInt(problemID, 10), cookie, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected delete 409, got %d", resp.StatusCode)
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
