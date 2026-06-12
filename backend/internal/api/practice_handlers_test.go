package api

import (
	"encoding/json"
	"net/http"
	"testing"
)

type practiceSubmissionRecordListData struct {
	Records []map[string]interface{} `json:"records"`
}

func TestPracticeLifecycle(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "practice_admin", "practiceadmin123")
	spaceID := mustCreateSpace(t, database, "Practice-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")

	problemID1 := mustCreateSpaceProblem(t, database, "Practice Problem 1")
	problemID2 := mustCreateSpaceProblem(t, database, "Practice Problem 2")

	cookie := mustLogin(t, app, "practice_admin", "practiceadmin123")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices", cookie, map[string]interface{}{
		"title":       "第一周练习",
		"description": "基础语法练习",
		"dueAt":       "2026-04-30T12:00:00Z",
		"displayMode": "list",
		"published":   true,
		"items": []map[string]interface{}{
			{"problemId": problemID1, "orderNo": 1, "score": 30},
			{"problemId": problemID2, "orderNo": 2, "score": 70},
		},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createResp.StatusCode)
	}
	createEnv := decodeEnvelope[map[string]int64](t, createResp)
	practiceID := createEnv.Data["id"]
	if practiceID <= 0 {
		t.Fatalf("invalid practice id: %+v", createEnv.Data)
	}

	getResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID), cookie, nil)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected get 200, got %d", getResp.StatusCode)
	}
	getEnv := decodeEnvelope[map[string]interface{}](t, getResp)
	if getEnv.Data["title"] != "第一周练习" {
		t.Fatalf("unexpected title: %+v", getEnv.Data["title"])
	}
	if getEnv.Data["displayMode"] != "list" {
		t.Fatalf("unexpected display mode: %+v", getEnv.Data["displayMode"])
	}
	items, ok := getEnv.Data["items"].([]interface{})
	if !ok || len(items) != 2 {
		t.Fatalf("unexpected items: %+v", getEnv.Data["items"])
	}

	updateResp := doJSONRequest(t, app, http.MethodPut, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID), cookie, map[string]interface{}{
		"title":       "第一周练习（更新）",
		"description": "只保留一道题",
		"displayMode": "exam",
		"published":   false,
		"items": []map[string]interface{}{
			{"problemId": problemID2, "orderNo": 1, "score": 100},
		},
	})
	if updateResp.StatusCode != http.StatusOK {
		t.Fatalf("expected update 200, got %d", updateResp.StatusCode)
	}
	updateResp.Body.Close()

	verifyResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID), cookie, nil)
	if verifyResp.StatusCode != http.StatusOK {
		t.Fatalf("expected verify 200, got %d", verifyResp.StatusCode)
	}
	verifyEnv := decodeEnvelope[map[string]interface{}](t, verifyResp)
	if verifyEnv.Data["title"] != "第一周练习（更新）" {
		t.Fatalf("unexpected updated title: %+v", verifyEnv.Data["title"])
	}
	if verifyEnv.Data["published"] != false {
		t.Fatalf("expected published=false, got %+v", verifyEnv.Data["published"])
	}
	if verifyEnv.Data["displayMode"] != "exam" {
		t.Fatalf("expected displayMode=exam, got %+v", verifyEnv.Data["displayMode"])
	}

	deleteResp := doJSONRequest(t, app, http.MethodDelete, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID), cookie, nil)
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected delete 200, got %d", deleteResp.StatusCode)
	}
	deleteResp.Body.Close()

	var count int
	if err := database.QueryRow(`SELECT COUNT(1) FROM practices WHERE id=?`, practiceID).Scan(&count); err != nil {
		t.Fatalf("query practice count: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected practice deleted, count=%d", count)
	}
}

func TestDeletePracticeCanDeleteAssociatedProblems(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "practice_delete_problem_admin", "practicedeleteproblem123")
	spaceID := mustCreateSpace(t, database, "Practice-Delete-Problem-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")

	exclusiveProblemID := mustCreateSpaceProblem(t, database, "练习独占题目")
	sharedProblemID := mustCreateSpaceProblem(t, database, "练习共享题目")

	targetPracticeRes, err := database.Exec(`
INSERT INTO practices(space_id, title, description, created_by, published)
VALUES(?, '待删除练习', '', ?, 1)`, spaceID, spaceAdminID)
	if err != nil {
		t.Fatalf("create target practice: %v", err)
	}
	targetPracticeID, _ := targetPracticeRes.LastInsertId()
	if _, err := database.Exec(`
INSERT INTO practice_items(practice_id, problem_id, order_no, score)
VALUES(?, ?, 1, 100), (?, ?, 2, 100)`, targetPracticeID, exclusiveProblemID, targetPracticeID, sharedProblemID); err != nil {
		t.Fatalf("create target practice items: %v", err)
	}
	submissionRes, err := database.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict, score, stdout, stderr, finished_at)
VALUES(?, ?, ?, 'programming', 'cpp', 'int main(){return 0;}', '', 'submit', 'done', 'AC', 100, '', '', CURRENT_TIMESTAMP)`,
		spaceAdminID, spaceID, exclusiveProblemID,
	)
	if err != nil {
		t.Fatalf("create exclusive submission: %v", err)
	}
	submissionID, _ := submissionRes.LastInsertId()
	if _, err := database.Exec(`
INSERT INTO user_problem_progress(space_id, user_id, problem_id, best_verdict, best_score, last_submission_id)
VALUES(?, ?, ?, 'AC', 100, ?)`, spaceID, spaceAdminID, exclusiveProblemID, submissionID); err != nil {
		t.Fatalf("create exclusive progress: %v", err)
	}
	recordRes, err := database.Exec(`
INSERT INTO practice_submission_records(practice_id, space_id, user_id, practice_item_count, practice_total_score)
VALUES(?, ?, ?, 2, 200)`, targetPracticeID, spaceID, spaceAdminID)
	if err != nil {
		t.Fatalf("create practice submission record: %v", err)
	}
	recordID, _ := recordRes.LastInsertId()
	if _, err := database.Exec(`
INSERT INTO practice_submission_record_items(record_id, problem_id, submission_id, order_no, item_score, problem_title, problem_type)
VALUES(?, ?, ?, 1, 100, '练习独占题目', 'programming')`, recordID, exclusiveProblemID, submissionID); err != nil {
		t.Fatalf("create practice submission record item: %v", err)
	}

	otherPracticeRes, err := database.Exec(`
INSERT INTO practices(space_id, title, description, created_by, published)
VALUES(?, '保留练习', '', ?, 1)`, spaceID, spaceAdminID)
	if err != nil {
		t.Fatalf("create other practice: %v", err)
	}
	otherPracticeID, _ := otherPracticeRes.LastInsertId()
	if _, err := database.Exec(`
INSERT INTO practice_items(practice_id, problem_id, order_no, score)
VALUES(?, ?, 1, 100)`, otherPracticeID, sharedProblemID); err != nil {
		t.Fatalf("create other practice item: %v", err)
	}

	cookie := mustLogin(t, app, "practice_delete_problem_admin", "practicedeleteproblem123")
	deleteResp := doJSONRequest(t, app, http.MethodDelete, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(targetPracticeID)+"?deleteProblems=1", cookie, nil)
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected delete 200, got %d", deleteResp.StatusCode)
	}
	deleteEnv := decodeEnvelope[map[string]interface{}](t, deleteResp)
	if deleteEnv.Data["deletedProblemCount"] != float64(1) {
		t.Fatalf("expected one deleted problem, got %+v", deleteEnv.Data)
	}

	var exclusiveCount int
	if err := database.QueryRow(`SELECT COUNT(1) FROM space_problems WHERE id=?`, exclusiveProblemID).Scan(&exclusiveCount); err != nil {
		t.Fatalf("count exclusive problem: %v", err)
	}
	if exclusiveCount != 0 {
		t.Fatalf("expected exclusive problem deleted, count=%d", exclusiveCount)
	}

	var sharedCount int
	if err := database.QueryRow(`SELECT COUNT(1) FROM space_problems WHERE id=?`, sharedProblemID).Scan(&sharedCount); err != nil {
		t.Fatalf("count shared problem: %v", err)
	}
	if sharedCount != 1 {
		t.Fatalf("expected shared problem retained, count=%d", sharedCount)
	}

	var submissionCount int
	if err := database.QueryRow(`SELECT COUNT(1) FROM submissions WHERE id=?`, submissionID).Scan(&submissionCount); err != nil {
		t.Fatalf("count exclusive submission: %v", err)
	}
	if submissionCount != 0 {
		t.Fatalf("expected exclusive submission deleted, count=%d", submissionCount)
	}

	var progressCount int
	if err := database.QueryRow(`SELECT COUNT(1) FROM user_problem_progress WHERE problem_id=? AND space_id=?`, exclusiveProblemID, spaceID).Scan(&progressCount); err != nil {
		t.Fatalf("count exclusive progress: %v", err)
	}
	if progressCount != 0 {
		t.Fatalf("expected exclusive progress deleted, count=%d", progressCount)
	}

	var recordItemCount int
	if err := database.QueryRow(`SELECT COUNT(1) FROM practice_submission_record_items WHERE record_id=?`, recordID).Scan(&recordItemCount); err != nil {
		t.Fatalf("count practice record items: %v", err)
	}
	if recordItemCount != 0 {
		t.Fatalf("expected practice record items deleted, count=%d", recordItemCount)
	}
}

func TestCreatePracticeWithProblemDrafts(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "practice_import_admin", "practiceimport123")
	spaceID := mustCreateSpace(t, database, "Practice-Import-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")

	cookie := mustLogin(t, app, "practice_import_admin", "practiceimport123")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices", cookie, map[string]interface{}{
		"title":       "导入建题练习",
		"description": "通过题目 JSON 数组自动建题",
		"displayMode": "list",
		"published":   true,
		"problemDrafts": []map[string]interface{}{
			{
				"type":        "single_choice",
				"title":       "导入单选题",
				"statementMd": "请选择正确答案",
				"bodyJson": map[string]interface{}{
					"options": []string{"A", "B", "C", "D"},
				},
				"answerJson": map[string]interface{}{
					"answerIndex": 2,
				},
			},
			{
				"type":        "programming",
				"title":       "导入编程题",
				"statementMd": "请输出 hello",
				"bodyJson": map[string]interface{}{
					"inputFormat":  "",
					"outputFormat": "输出 hello",
				},
				"answerJson": map[string]interface{}{},
			},
		},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected import create 200, got %d", createResp.StatusCode)
	}
	practiceID := decodeEnvelope[map[string]int64](t, createResp).Data["id"]
	if practiceID <= 0 {
		t.Fatalf("invalid practice id: %d", practiceID)
	}

	getResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID), cookie, nil)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected get 200, got %d", getResp.StatusCode)
	}
	getEnv := decodeEnvelope[map[string]interface{}](t, getResp)
	if getEnv.Data["displayMode"] != "list" {
		t.Fatalf("expected displayMode=list, got %+v", getEnv.Data["displayMode"])
	}
	items, ok := getEnv.Data["items"].([]interface{})
	if !ok || len(items) != 2 {
		t.Fatalf("unexpected practice items: %+v", getEnv.Data["items"])
	}

	var problemCount int
	if err := database.QueryRow(`SELECT COUNT(1) FROM space_problems WHERE space_id=?`, spaceID).Scan(&problemCount); err != nil {
		t.Fatalf("count imported problems: %v", err)
	}
	if problemCount != 2 {
		t.Fatalf("expected 2 imported problems, got %d", problemCount)
	}

	var importedAnswerJSON string
	if err := database.QueryRow(`SELECT answer_json FROM space_problems WHERE space_id=? AND title=?`, spaceID, "导入单选题").Scan(&importedAnswerJSON); err != nil {
		t.Fatalf("query imported answer json: %v", err)
	}
	var importedAnswer map[string]interface{}
	if err := json.Unmarshal([]byte(importedAnswerJSON), &importedAnswer); err != nil {
		t.Fatalf("decode imported answer json: %v", err)
	}
	if importedAnswer["answerIndex"] != float64(2) {
		t.Fatalf("expected imported answerIndex 2, got %+v", importedAnswer)
	}
}

func TestPracticeVisibilityRules(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "practice_visibility_admin", "practicevisibility123")
	memberAssignedID := seedUser(t, database, "practice_member_assigned", "assignedmember123")
	memberOtherID := seedUser(t, database, "practice_member_other", "othermember123")
	spaceID := mustCreateSpace(t, database, "Practice-Visibility-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberAssignedID, "member")
	mustAddMember(t, database, spaceID, memberOtherID, "member")

	problemID := mustCreateSpaceProblem(t, database, "Practice Visibility Problem")

	adminCookie := mustLogin(t, app, "practice_visibility_admin", "practicevisibility123")
	createPractice := func(title string, published bool) int64 {
		resp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices", adminCookie, map[string]interface{}{
			"title":     title,
			"published": published,
			"items": []map[string]interface{}{
				{"problemId": problemID, "orderNo": 1, "score": 100},
			},
		})
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected create 200 for %s, got %d", title, resp.StatusCode)
		}
		env := decodeEnvelope[map[string]int64](t, resp)
		return env.Data["id"]
	}

	_ = createPractice("公开未定向练习", true)
	publicTargetedID := createPractice("公开定向练习", true)
	draftTargetedID := createPractice("草稿定向练习", false)

	assignAssignedResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(publicTargetedID)+"/targets", adminCookie, map[string]int64{
		"userId": memberAssignedID,
	})
	if assignAssignedResp.StatusCode != http.StatusOK {
		t.Fatalf("expected public targeted assign 200, got %d", assignAssignedResp.StatusCode)
	}
	assignAssignedResp.Body.Close()

	assignDraftResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(draftTargetedID)+"/targets", adminCookie, map[string]int64{
		"userId": memberAssignedID,
	})
	if assignDraftResp.StatusCode != http.StatusOK {
		t.Fatalf("expected draft targeted assign 200, got %d", assignDraftResp.StatusCode)
	}
	assignDraftResp.Body.Close()

	adminListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices", adminCookie, nil)
	if adminListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected admin list 200, got %d", adminListResp.StatusCode)
	}
	adminPractices := decodeEnvelope[[]map[string]interface{}](t, adminListResp).Data
	if len(adminPractices) != 3 {
		t.Fatalf("expected admin to see 3 practices, got %d", len(adminPractices))
	}

	memberAssignedCookie := mustLogin(t, app, "practice_member_assigned", "assignedmember123")
	memberAssignedListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices", memberAssignedCookie, nil)
	if memberAssignedListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected assigned member list 200, got %d", memberAssignedListResp.StatusCode)
	}
	memberAssignedPractices := decodeEnvelope[[]map[string]interface{}](t, memberAssignedListResp).Data
	if len(memberAssignedPractices) != 1 {
		t.Fatalf("expected assigned member to see 1 practice, got %d", len(memberAssignedPractices))
	}

	assignedByID := map[int64]bool{}
	for _, practice := range memberAssignedPractices {
		id, _ := practice["id"].(float64)
		assigned, _ := practice["assigned"].(bool)
		assignedByID[int64(id)] = assigned
	}
	if assignedByID[publicTargetedID] != true {
		t.Fatalf("expected targeted practice assigned=true, got %+v", assignedByID)
	}

	memberOtherCookie := mustLogin(t, app, "practice_member_other", "othermember123")
	memberOtherListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices", memberOtherCookie, nil)
	if memberOtherListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected other member list 200, got %d", memberOtherListResp.StatusCode)
	}
	memberOtherPractices := decodeEnvelope[[]map[string]interface{}](t, memberOtherListResp).Data
	if len(memberOtherPractices) != 0 {
		t.Fatalf("expected other member to see 0 practices, got %d", len(memberOtherPractices))
	}

	targetedGetResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(publicTargetedID), memberAssignedCookie, nil)
	if targetedGetResp.StatusCode != http.StatusOK {
		t.Fatalf("expected assigned targeted get 200, got %d", targetedGetResp.StatusCode)
	}
	targetedGetResp.Body.Close()

	otherTargetedGetResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(publicTargetedID), memberOtherCookie, nil)
	if otherTargetedGetResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected untargeted member get 404, got %d", otherTargetedGetResp.StatusCode)
	}
	otherTargetedGetResp.Body.Close()

	draftGetResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(draftTargetedID), memberAssignedCookie, nil)
	if draftGetResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected draft practice get 404, got %d", draftGetResp.StatusCode)
	}
	draftGetResp.Body.Close()
}

func TestPracticeTargetCandidatesSearchByUsername(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "practice_target_admin", "targetadmin123")
	memberID := seedUser(t, database, "practice_target_alice", "targetalice123")
	assignedMemberID := seedUser(t, database, "practice_target_bob", "targetbob123")
	otherSpaceUserID := seedUser(t, database, "practice_target_outside", "targetoutside123")
	spaceID := mustCreateSpace(t, database, "Practice-Target-Candidate-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberID, "member")
	mustAddMember(t, database, spaceID, assignedMemberID, "member")
	problemID := mustCreateSpaceProblem(t, database, "Practice Target Candidate Problem")

	otherSpaceID := mustCreateSpace(t, database, "Practice-Target-Other-Space")
	mustAddMember(t, database, otherSpaceID, otherSpaceUserID, "member")

	adminCookie := mustLogin(t, app, "practice_target_admin", "targetadmin123")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices", adminCookie, map[string]interface{}{
		"title":       "Target Candidate Practice",
		"displayMode": "exam",
		"published":   true,
		"items": []map[string]interface{}{
			{
				"problemId": problemID,
				"orderNo":   1,
				"score":     100,
			},
		},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createResp.StatusCode)
	}
	practiceID := decodeEnvelope[map[string]int64](t, createResp).Data["id"]

	assignResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID)+"/targets", adminCookie, map[string]int64{
		"userId": assignedMemberID,
	})
	if assignResp.StatusCode != http.StatusOK {
		t.Fatalf("expected assign 200, got %d", assignResp.StatusCode)
	}
	assignResp.Body.Close()

	searchResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID)+"/target-candidates?q=practice_target", adminCookie, nil)
	if searchResp.StatusCode != http.StatusOK {
		t.Fatalf("expected search 200, got %d", searchResp.StatusCode)
	}
	candidates := decodeEnvelope[[]map[string]interface{}](t, searchResp).Data
	ids := map[int64]bool{}
	for _, candidate := range candidates {
		id, _ := candidate["id"].(float64)
		ids[int64(id)] = true
	}
	if !ids[memberID] {
		t.Fatalf("expected unassigned member candidate %d, got %+v", memberID, candidates)
	}
	if ids[assignedMemberID] {
		t.Fatalf("did not expect already assigned member %d, got %+v", assignedMemberID, candidates)
	}
	if ids[otherSpaceUserID] {
		t.Fatalf("did not expect user outside this space %d, got %+v", otherSpaceUserID, candidates)
	}
}

func TestPracticeSubmissionRecordLifecycle(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "practice_record_admin", "recordadmin123")
	memberID := seedUser(t, database, "practice_record_member", "recordmember123")
	spaceID := mustCreateSpace(t, database, "Practice-Record-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberID, "member")

	objectiveRes, err := database.Exec(`
INSERT INTO space_problems(space_id, type, title, statement_md, body_json, answer_json, created_by)
VALUES(?, 'single_choice', 'Objective Problem', 'statement', '{"options":["A","B"]}', '{"answer":"A"}', 1)`, spaceID)
	if err != nil {
		t.Fatalf("create objective problem: %v", err)
	}
	objectiveProblemID, _ := objectiveRes.LastInsertId()

	programmingRes, err := database.Exec(`
INSERT INTO space_problems(space_id, type, title, statement_md, body_json, answer_json, created_by)
VALUES(?, 'programming', 'Programming Problem', 'statement', '{}', '{}', 1)`, spaceID)
	if err != nil {
		t.Fatalf("create programming problem: %v", err)
	}
	programmingProblemID, _ := programmingRes.LastInsertId()

	adminCookie := mustLogin(t, app, "practice_record_admin", "recordadmin123")
	createPracticeResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices", adminCookie, map[string]interface{}{
		"title":     "记录练习",
		"published": true,
		"items": []map[string]interface{}{
			{"problemId": objectiveProblemID, "orderNo": 1, "score": 40},
			{"problemId": programmingProblemID, "orderNo": 2, "score": 60},
		},
	})
	if createPracticeResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create practice 200, got %d", createPracticeResp.StatusCode)
	}
	practiceID := decodeEnvelope[map[string]int64](t, createPracticeResp).Data["id"]

	objectiveSubmissionRes, err := database.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict, score, stdout, stderr, finished_at)
VALUES(?, ?, ?, 'single_choice', '', '', 'A', 'objective', 'done', 'AC', 100, '', '', CURRENT_TIMESTAMP)`,
		memberID, spaceID, objectiveProblemID,
	)
	if err != nil {
		t.Fatalf("create objective submission: %v", err)
	}
	objectiveSubmissionID, _ := objectiveSubmissionRes.LastInsertId()

	programmingSubmissionRes, err := database.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict, score, stdout, stderr)
VALUES(?, ?, ?, 'programming', 'cpp', 'int main(){}', '', 'submit', 'queued', 'PENDING', 0, '', '')`,
		memberID, spaceID, programmingProblemID,
	)
	if err != nil {
		t.Fatalf("create programming submission: %v", err)
	}
	programmingSubmissionID, _ := programmingSubmissionRes.LastInsertId()

	memberCookie := mustLogin(t, app, "practice_record_member", "recordmember123")
	createRecordResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID)+"/submission-records", memberCookie, map[string]interface{}{
		"items": []map[string]int64{
			{"problemId": objectiveProblemID, "submissionId": objectiveSubmissionID},
			{"problemId": programmingProblemID, "submissionId": programmingSubmissionID},
		},
	})
	if createRecordResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create record 200, got %d", createRecordResp.StatusCode)
	}
	recordID := decodeEnvelope[map[string]int64](t, createRecordResp).Data["id"]
	if recordID <= 0 {
		t.Fatalf("invalid record id: %d", recordID)
	}

	listResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID)+"/submission-records", memberCookie, nil)
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("expected list records 200, got %d", listResp.StatusCode)
	}
	listEnv := decodeEnvelope[practiceSubmissionRecordListData](t, listResp)
	if len(listEnv.Data.Records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(listEnv.Data.Records))
	}

	record := listEnv.Data.Records[0]
	if record["statusText"] != "判题中" {
		t.Fatalf("unexpected statusText: %+v", record["statusText"])
	}
	if record["answeredCount"] != float64(2) {
		t.Fatalf("unexpected answeredCount: %+v", record["answeredCount"])
	}
	if record["objectiveCount"] != float64(1) || record["programmingCount"] != float64(1) {
		t.Fatalf("unexpected type counters: %+v", record)
	}
	if record["resolvedScore"] != float64(40) {
		t.Fatalf("unexpected resolvedScore: %+v", record["resolvedScore"])
	}
	if record["practiceTotalScore"] != float64(100) {
		t.Fatalf("unexpected practiceTotalScore: %+v", record["practiceTotalScore"])
	}

	items, ok := record["items"].([]interface{})
	if !ok || len(items) != 2 {
		t.Fatalf("unexpected record items: %+v", record["items"])
	}
	firstItem, ok := items[0].(map[string]interface{})
	if !ok {
		t.Fatalf("unexpected first record item: %+v", items[0])
	}
	if firstItem["problemTitle"] != "Objective Problem" {
		t.Fatalf("unexpected first problem title: %+v", firstItem["problemTitle"])
	}
	if firstItem["verdict"] != "AC" {
		t.Fatalf("unexpected first verdict: %+v", firstItem["verdict"])
	}
	secondItem, ok := items[1].(map[string]interface{})
	if !ok {
		t.Fatalf("unexpected second record item: %+v", items[1])
	}
	if secondItem["status"] != "queued" {
		t.Fatalf("unexpected second status: %+v", secondItem["status"])
	}
}

func TestPracticeSubmissionRecordList_AllowsAdminsToViewAll(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "practice_all_admin", "practicealladmin123")
	memberAID := seedUser(t, database, "practice_all_member_a", "practiceallmembera123")
	memberBID := seedUser(t, database, "practice_all_member_b", "practiceallmemberb123")
	spaceID := mustCreateSpace(t, database, "Practice-All-Record-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberAID, "member")
	mustAddMember(t, database, spaceID, memberBID, "member")

	problemRes, err := database.Exec(`
INSERT INTO space_problems(space_id, type, title, statement_md, body_json, answer_json, created_by)
VALUES(?, 'single_choice', 'Practice All Objective', 'statement', '{"options":["A","B"]}', '{"answer":"A"}', 1)`, spaceID)
	if err != nil {
		t.Fatalf("create problem: %v", err)
	}
	problemID, _ := problemRes.LastInsertId()
	spaceAdminCookie := mustLogin(t, app, "practice_all_admin", "practicealladmin123")
	createPracticeResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices", spaceAdminCookie, map[string]interface{}{
		"title":     "管理员查看全部练习记录",
		"published": true,
		"items": []map[string]interface{}{
			{"problemId": problemID, "orderNo": 1, "score": 100},
		},
	})
	if createPracticeResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create practice 200, got %d", createPracticeResp.StatusCode)
	}
	practiceID := decodeEnvelope[map[string]int64](t, createPracticeResp).Data["id"]

	submissionARes, err := database.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict, score, stdout, stderr, finished_at)
VALUES(?, ?, ?, 'single_choice', '', '', 'A', 'objective', 'done', 'AC', 100, '', '', CURRENT_TIMESTAMP)`,
		memberAID, spaceID, problemID,
	)
	if err != nil {
		t.Fatalf("create member A submission: %v", err)
	}
	submissionAID, _ := submissionARes.LastInsertId()

	submissionBRes, err := database.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict, score, stdout, stderr, finished_at)
VALUES(?, ?, ?, 'single_choice', '', '', 'B', 'objective', 'done', 'WA', 0, '', '', CURRENT_TIMESTAMP)`,
		memberBID, spaceID, problemID,
	)
	if err != nil {
		t.Fatalf("create member B submission: %v", err)
	}
	submissionBID, _ := submissionBRes.LastInsertId()

	memberACookie := mustLogin(t, app, "practice_all_member_a", "practiceallmembera123")
	createRecordAResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID)+"/submission-records", memberACookie, map[string]interface{}{
		"items": []map[string]int64{
			{"problemId": problemID, "submissionId": submissionAID},
		},
	})
	if createRecordAResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create member A record 200, got %d", createRecordAResp.StatusCode)
	}

	memberBCookie := mustLogin(t, app, "practice_all_member_b", "practiceallmemberb123")
	createRecordBResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID)+"/submission-records", memberBCookie, map[string]interface{}{
		"items": []map[string]int64{
			{"problemId": problemID, "submissionId": submissionBID},
		},
	})
	if createRecordBResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create member B record 200, got %d", createRecordBResp.StatusCode)
	}

	memberListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID)+"/submission-records?all=1", memberACookie, nil)
	if memberListResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected member list 403, got %d", memberListResp.StatusCode)
	}

	adminListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID)+"/submission-records?all=1", spaceAdminCookie, nil)
	if adminListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected admin list 200, got %d", adminListResp.StatusCode)
	}
	adminRecords := decodeEnvelope[practiceSubmissionRecordListData](t, adminListResp).Data.Records
	if len(adminRecords) != 2 {
		t.Fatalf("expected admin to see 2 records, got %d", len(adminRecords))
	}

	systemAdminCookie := mustLogin(t, app, "admin", "admin123456")
	systemAdminListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/practices/"+itoa(practiceID)+"/submission-records?all=1", systemAdminCookie, nil)
	if systemAdminListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected system admin list 200, got %d", systemAdminListResp.StatusCode)
	}
	systemAdminRecords := decodeEnvelope[practiceSubmissionRecordListData](t, systemAdminListResp).Data.Records
	if len(systemAdminRecords) != 2 {
		t.Fatalf("expected system admin to see 2 records, got %d", len(systemAdminRecords))
	}
}
