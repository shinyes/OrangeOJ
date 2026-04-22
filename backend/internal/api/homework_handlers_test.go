package api

import (
	"net/http"
	"testing"
)

type homeworkSubmissionRecordListData struct {
	Records []map[string]interface{} `json:"records"`
}

func TestHomeworkLifecycle(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "homework_admin", "homeworkadmin123")
	spaceID := mustCreateSpace(t, database, "Homework-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")

	problemID1 := mustCreateRootProblem(t, database, "Homework Problem 1")
	problemID2 := mustCreateRootProblem(t, database, "Homework Problem 2")
	if _, err := database.Exec(`INSERT INTO space_problem_links(space_id, problem_id) VALUES(?, ?), (?, ?)`, spaceID, problemID1, spaceID, problemID2); err != nil {
		t.Fatalf("link problems to space: %v", err)
	}

	cookie := mustLogin(t, app, "homework_admin", "homeworkadmin123")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/homeworks", cookie, map[string]interface{}{
		"title":       "第一周作业",
		"description": "基础语法作业",
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
	homeworkID := createEnv.Data["id"]
	if homeworkID <= 0 {
		t.Fatalf("invalid homework id: %+v", createEnv.Data)
	}

	getResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID), cookie, nil)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected get 200, got %d", getResp.StatusCode)
	}
	getEnv := decodeEnvelope[map[string]interface{}](t, getResp)
	if getEnv.Data["title"] != "第一周作业" {
		t.Fatalf("unexpected title: %+v", getEnv.Data["title"])
	}
	if getEnv.Data["displayMode"] != "list" {
		t.Fatalf("unexpected display mode: %+v", getEnv.Data["displayMode"])
	}
	items, ok := getEnv.Data["items"].([]interface{})
	if !ok || len(items) != 2 {
		t.Fatalf("unexpected items: %+v", getEnv.Data["items"])
	}

	updateResp := doJSONRequest(t, app, http.MethodPut, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID), cookie, map[string]interface{}{
		"title":       "第一周作业（更新）",
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

	verifyResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID), cookie, nil)
	if verifyResp.StatusCode != http.StatusOK {
		t.Fatalf("expected verify 200, got %d", verifyResp.StatusCode)
	}
	verifyEnv := decodeEnvelope[map[string]interface{}](t, verifyResp)
	if verifyEnv.Data["title"] != "第一周作业（更新）" {
		t.Fatalf("unexpected updated title: %+v", verifyEnv.Data["title"])
	}
	if verifyEnv.Data["published"] != false {
		t.Fatalf("expected published=false, got %+v", verifyEnv.Data["published"])
	}
	if verifyEnv.Data["displayMode"] != "exam" {
		t.Fatalf("expected displayMode=exam, got %+v", verifyEnv.Data["displayMode"])
	}

	deleteResp := doJSONRequest(t, app, http.MethodDelete, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID), cookie, nil)
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected delete 200, got %d", deleteResp.StatusCode)
	}
	deleteResp.Body.Close()

	var count int
	if err := database.QueryRow(`SELECT COUNT(1) FROM homeworks WHERE id=?`, homeworkID).Scan(&count); err != nil {
		t.Fatalf("query homework count: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected homework deleted, count=%d", count)
	}
}

func TestHomeworkVisibilityRules(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "homework_visibility_admin", "homeworkvisibility123")
	memberAssignedID := seedUser(t, database, "homework_member_assigned", "assignedmember123")
	memberOtherID := seedUser(t, database, "homework_member_other", "othermember123")
	spaceID := mustCreateSpace(t, database, "Homework-Visibility-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberAssignedID, "member")
	mustAddMember(t, database, spaceID, memberOtherID, "member")

	problemID := mustCreateRootProblem(t, database, "Homework Visibility Problem")
	if _, err := database.Exec(`INSERT INTO space_problem_links(space_id, problem_id) VALUES(?, ?)`, spaceID, problemID); err != nil {
		t.Fatalf("link problem to space: %v", err)
	}

	adminCookie := mustLogin(t, app, "homework_visibility_admin", "homeworkvisibility123")
	createHomework := func(title string, published bool) int64 {
		resp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/homeworks", adminCookie, map[string]interface{}{
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

	publicOpenID := createHomework("公开未定向作业", true)
	publicTargetedID := createHomework("公开定向作业", true)
	draftTargetedID := createHomework("草稿定向作业", false)

	assignAssignedResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(publicTargetedID)+"/targets", adminCookie, map[string]int64{
		"userId": memberAssignedID,
	})
	if assignAssignedResp.StatusCode != http.StatusOK {
		t.Fatalf("expected public targeted assign 200, got %d", assignAssignedResp.StatusCode)
	}
	assignAssignedResp.Body.Close()

	assignDraftResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(draftTargetedID)+"/targets", adminCookie, map[string]int64{
		"userId": memberAssignedID,
	})
	if assignDraftResp.StatusCode != http.StatusOK {
		t.Fatalf("expected draft targeted assign 200, got %d", assignDraftResp.StatusCode)
	}
	assignDraftResp.Body.Close()

	adminListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks", adminCookie, nil)
	if adminListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected admin list 200, got %d", adminListResp.StatusCode)
	}
	adminHomeworks := decodeEnvelope[[]map[string]interface{}](t, adminListResp).Data
	if len(adminHomeworks) != 3 {
		t.Fatalf("expected admin to see 3 homeworks, got %d", len(adminHomeworks))
	}

	memberAssignedCookie := mustLogin(t, app, "homework_member_assigned", "assignedmember123")
	memberAssignedListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks", memberAssignedCookie, nil)
	if memberAssignedListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected assigned member list 200, got %d", memberAssignedListResp.StatusCode)
	}
	memberAssignedHomeworks := decodeEnvelope[[]map[string]interface{}](t, memberAssignedListResp).Data
	if len(memberAssignedHomeworks) != 2 {
		t.Fatalf("expected assigned member to see 2 homeworks, got %d", len(memberAssignedHomeworks))
	}

	assignedByID := map[int64]bool{}
	for _, homework := range memberAssignedHomeworks {
		id, _ := homework["id"].(float64)
		assigned, _ := homework["assigned"].(bool)
		assignedByID[int64(id)] = assigned
	}
	if assignedByID[publicTargetedID] != true {
		t.Fatalf("expected targeted homework assigned=true, got %+v", assignedByID)
	}
	if assignedByID[publicOpenID] != false {
		t.Fatalf("expected open homework assigned=false, got %+v", assignedByID)
	}

	memberOtherCookie := mustLogin(t, app, "homework_member_other", "othermember123")
	memberOtherListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks", memberOtherCookie, nil)
	if memberOtherListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected other member list 200, got %d", memberOtherListResp.StatusCode)
	}
	memberOtherHomeworks := decodeEnvelope[[]map[string]interface{}](t, memberOtherListResp).Data
	if len(memberOtherHomeworks) != 1 {
		t.Fatalf("expected other member to see 1 homework, got %d", len(memberOtherHomeworks))
	}

	targetedGetResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(publicTargetedID), memberAssignedCookie, nil)
	if targetedGetResp.StatusCode != http.StatusOK {
		t.Fatalf("expected assigned targeted get 200, got %d", targetedGetResp.StatusCode)
	}
	targetedGetResp.Body.Close()

	otherTargetedGetResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(publicTargetedID), memberOtherCookie, nil)
	if otherTargetedGetResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected untargeted member get 404, got %d", otherTargetedGetResp.StatusCode)
	}
	otherTargetedGetResp.Body.Close()

	draftGetResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(draftTargetedID), memberAssignedCookie, nil)
	if draftGetResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected draft homework get 404, got %d", draftGetResp.StatusCode)
	}
	draftGetResp.Body.Close()
}

func TestHomeworkSubmissionRecordLifecycle(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "homework_record_admin", "recordadmin123")
	memberID := seedUser(t, database, "homework_record_member", "recordmember123")
	spaceID := mustCreateSpace(t, database, "Homework-Record-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberID, "member")

	objectiveRes, err := database.Exec(`
INSERT INTO root_problems(type, title, statement_md, body_json, answer_json, created_by)
VALUES('single_choice', 'Objective Problem', 'statement', '{"options":["A","B"]}', '{"answer":"A"}', 1)`)
	if err != nil {
		t.Fatalf("create objective problem: %v", err)
	}
	objectiveProblemID, _ := objectiveRes.LastInsertId()

	programmingRes, err := database.Exec(`
INSERT INTO root_problems(type, title, statement_md, body_json, answer_json, created_by)
VALUES('programming', 'Programming Problem', 'statement', '{}', '{}', 1)`)
	if err != nil {
		t.Fatalf("create programming problem: %v", err)
	}
	programmingProblemID, _ := programmingRes.LastInsertId()

	if _, err := database.Exec(`
INSERT INTO space_problem_links(space_id, problem_id) VALUES(?, ?), (?, ?)`,
		spaceID, objectiveProblemID, spaceID, programmingProblemID,
	); err != nil {
		t.Fatalf("link problems to space: %v", err)
	}

	adminCookie := mustLogin(t, app, "homework_record_admin", "recordadmin123")
	createHomeworkResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/homeworks", adminCookie, map[string]interface{}{
		"title":     "记录作业",
		"published": true,
		"items": []map[string]interface{}{
			{"problemId": objectiveProblemID, "orderNo": 1, "score": 40},
			{"problemId": programmingProblemID, "orderNo": 2, "score": 60},
		},
	})
	if createHomeworkResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create homework 200, got %d", createHomeworkResp.StatusCode)
	}
	homeworkID := decodeEnvelope[map[string]int64](t, createHomeworkResp).Data["id"]

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

	memberCookie := mustLogin(t, app, "homework_record_member", "recordmember123")
	createRecordResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID)+"/submission-records", memberCookie, map[string]interface{}{
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

	listResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID)+"/submission-records", memberCookie, nil)
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("expected list records 200, got %d", listResp.StatusCode)
	}
	listEnv := decodeEnvelope[homeworkSubmissionRecordListData](t, listResp)
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
	if record["homeworkTotalScore"] != float64(100) {
		t.Fatalf("unexpected homeworkTotalScore: %+v", record["homeworkTotalScore"])
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

func TestHomeworkSubmissionRecordList_AllowsAdminsToViewAll(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "homework_all_admin", "homeworkalladmin123")
	memberAID := seedUser(t, database, "homework_all_member_a", "homeworkallmembera123")
	memberBID := seedUser(t, database, "homework_all_member_b", "homeworkallmemberb123")
	spaceID := mustCreateSpace(t, database, "Homework-All-Record-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberAID, "member")
	mustAddMember(t, database, spaceID, memberBID, "member")

	problemRes, err := database.Exec(`
INSERT INTO root_problems(type, title, statement_md, body_json, answer_json, created_by)
VALUES('single_choice', 'Homework All Objective', 'statement', '{"options":["A","B"]}', '{"answer":"A"}', 1)`)
	if err != nil {
		t.Fatalf("create problem: %v", err)
	}
	problemID, _ := problemRes.LastInsertId()
	if _, err := database.Exec(`INSERT INTO space_problem_links(space_id, problem_id) VALUES(?, ?)`, spaceID, problemID); err != nil {
		t.Fatalf("link problem: %v", err)
	}

	spaceAdminCookie := mustLogin(t, app, "homework_all_admin", "homeworkalladmin123")
	createHomeworkResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/homeworks", spaceAdminCookie, map[string]interface{}{
		"title":     "管理员查看全部作业记录",
		"published": true,
		"items": []map[string]interface{}{
			{"problemId": problemID, "orderNo": 1, "score": 100},
		},
	})
	if createHomeworkResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create homework 200, got %d", createHomeworkResp.StatusCode)
	}
	homeworkID := decodeEnvelope[map[string]int64](t, createHomeworkResp).Data["id"]

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

	memberACookie := mustLogin(t, app, "homework_all_member_a", "homeworkallmembera123")
	createRecordAResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID)+"/submission-records", memberACookie, map[string]interface{}{
		"items": []map[string]int64{
			{"problemId": problemID, "submissionId": submissionAID},
		},
	})
	if createRecordAResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create member A record 200, got %d", createRecordAResp.StatusCode)
	}

	memberBCookie := mustLogin(t, app, "homework_all_member_b", "homeworkallmemberb123")
	createRecordBResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID)+"/submission-records", memberBCookie, map[string]interface{}{
		"items": []map[string]int64{
			{"problemId": problemID, "submissionId": submissionBID},
		},
	})
	if createRecordBResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create member B record 200, got %d", createRecordBResp.StatusCode)
	}

	memberListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID)+"/submission-records?all=1", memberACookie, nil)
	if memberListResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected member list 403, got %d", memberListResp.StatusCode)
	}

	adminListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID)+"/submission-records?all=1", spaceAdminCookie, nil)
	if adminListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected admin list 200, got %d", adminListResp.StatusCode)
	}
	adminRecords := decodeEnvelope[homeworkSubmissionRecordListData](t, adminListResp).Data.Records
	if len(adminRecords) != 2 {
		t.Fatalf("expected admin to see 2 records, got %d", len(adminRecords))
	}

	systemAdminCookie := mustLogin(t, app, "admin", "admin123456")
	systemAdminListResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/homeworks/"+itoa(homeworkID)+"/submission-records?all=1", systemAdminCookie, nil)
	if systemAdminListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected system admin list 200, got %d", systemAdminListResp.StatusCode)
	}
	systemAdminRecords := decodeEnvelope[homeworkSubmissionRecordListData](t, systemAdminListResp).Data.Records
	if len(systemAdminRecords) != 2 {
		t.Fatalf("expected system admin to see 2 records, got %d", len(systemAdminRecords))
	}
}
