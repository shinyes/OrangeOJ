package api

import (
	"net/http"
	"testing"
)

func TestEvaluateObjectiveAnswer(t *testing.T) {
	ok, err := evaluateObjectiveAnswer("single_choice", `{"answer":"B"}`, "b")
	if err != nil {
		t.Fatalf("single choice error: %v", err)
	}
	if !ok {
		t.Fatalf("expected single choice answer to be correct")
	}

	ok, err = evaluateObjectiveAnswer("true_false", `{"answer":true}`, false)
	if err != nil {
		t.Fatalf("true false error: %v", err)
	}
	if ok {
		t.Fatalf("expected true/false answer to be wrong")
	}
}

func TestListSubmissionsIncludesCaseDetails(t *testing.T) {
	app, database := newTestApp(t, false)

	memberID := seedUser(t, database, "submission_case_member", "submission123")
	spaceID := mustCreateSpace(t, database, "Submission-Case-Space")
	mustAddMember(t, database, spaceID, memberID, "member")

	problemID := mustCreateRootProblem(t, database, "Submission Case Problem")
	if _, err := database.Exec(`INSERT INTO space_problem_links(space_id, problem_id) VALUES(?, ?)`, spaceID, problemID); err != nil {
		t.Fatalf("link problem to space: %v", err)
	}

	caseDetailsJSON := `[{"caseNo":1,"verdict":"AC","input":"1 2","output":"3","expectedOutput":"3","error":"","timeMs":5,"memoryKiB":1024},{"caseNo":2,"verdict":"WA","input":"2 3","output":"4","expectedOutput":"5","error":"Expected output:\n5","timeMs":6,"memoryKiB":1024}]`
	if _, err := database.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict, time_ms, memory_kib, score, stdout, stderr, case_details_json)
VALUES(?, ?, ?, 'programming', 'cpp', 'int main(){}', '', 'submit', 'done', 'WA', 6, 1024, 0, '4', 'Expected output:\n5', ?)`, memberID, spaceID, problemID, caseDetailsJSON); err != nil {
		t.Fatalf("seed submission: %v", err)
	}

	cookie := mustLogin(t, app, "submission_case_member", "submission123")
	resp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/problems/"+itoa(problemID)+"/submissions", cookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected list 200, got %d", resp.StatusCode)
	}

	result := decodeEnvelope[map[string][]map[string]interface{}](t, resp)
	submissions := result.Data["submissions"]
	if len(submissions) != 1 {
		t.Fatalf("expected 1 submission, got %d", len(submissions))
	}
	caseDetails, ok := submissions[0]["caseDetails"].([]interface{})
	if !ok || len(caseDetails) != 2 {
		t.Fatalf("unexpected case details payload: %+v", submissions[0]["caseDetails"])
	}
	firstCase, ok := caseDetails[0].(map[string]interface{})
	if !ok {
		t.Fatalf("unexpected first case payload: %+v", caseDetails[0])
	}
	if firstCase["input"] != "1 2" {
		t.Fatalf("unexpected first case input: %+v", firstCase["input"])
	}
	if firstCase["expectedOutput"] != "3" {
		t.Fatalf("unexpected first case expected output: %+v", firstCase["expectedOutput"])
	}
}

func TestListSubmissions_AllowsAdminsToViewAll(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "submission_space_admin", "spaceadmin123")
	memberAID := seedUser(t, database, "submission_member_a", "membera123")
	memberBID := seedUser(t, database, "submission_member_b", "memberb123")
	spaceID := mustCreateSpace(t, database, "Submission-All-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberAID, "member")
	mustAddMember(t, database, spaceID, memberBID, "member")

	problemID := mustCreateRootProblem(t, database, "Submission All Problem")
	if _, err := database.Exec(`INSERT INTO space_problem_links(space_id, problem_id) VALUES(?, ?)`, spaceID, problemID); err != nil {
		t.Fatalf("link problem to space: %v", err)
	}

	if _, err := database.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict)
VALUES(?, ?, ?, 'programming', 'cpp', 'int main(){return 0;}', '', 'submit', 'done', 'AC'),
      (?, ?, ?, 'programming', 'cpp', 'int main(){return 1;}', '', 'submit', 'done', 'WA')`,
		memberAID, spaceID, problemID,
		memberBID, spaceID, problemID,
	); err != nil {
		t.Fatalf("seed submissions: %v", err)
	}

	memberCookie := mustLogin(t, app, "submission_member_a", "membera123")
	memberResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/problems/"+itoa(problemID)+"/submissions?all=1", memberCookie, nil)
	if memberResp.StatusCode != http.StatusOK {
		t.Fatalf("expected member list 200, got %d", memberResp.StatusCode)
	}
	memberSubmissions := decodeEnvelope[map[string][]map[string]interface{}](t, memberResp).Data["submissions"]
	if len(memberSubmissions) != 1 {
		t.Fatalf("expected member to still see own 1 submission, got %d", len(memberSubmissions))
	}

	spaceAdminCookie := mustLogin(t, app, "submission_space_admin", "spaceadmin123")
	spaceAdminResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/problems/"+itoa(problemID)+"/submissions?all=1", spaceAdminCookie, nil)
	if spaceAdminResp.StatusCode != http.StatusOK {
		t.Fatalf("expected space admin list 200, got %d", spaceAdminResp.StatusCode)
	}
	spaceAdminSubmissions := decodeEnvelope[map[string][]map[string]interface{}](t, spaceAdminResp).Data["submissions"]
	if len(spaceAdminSubmissions) != 2 {
		t.Fatalf("expected space admin to see 2 submissions, got %d", len(spaceAdminSubmissions))
	}

	systemAdminCookie := mustLogin(t, app, "admin", "admin123456")
	systemAdminResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/problems/"+itoa(problemID)+"/submissions?all=1", systemAdminCookie, nil)
	if systemAdminResp.StatusCode != http.StatusOK {
		t.Fatalf("expected system admin list 200, got %d", systemAdminResp.StatusCode)
	}
	systemAdminSubmissions := decodeEnvelope[map[string][]map[string]interface{}](t, systemAdminResp).Data["submissions"]
	if len(systemAdminSubmissions) != 2 {
		t.Fatalf("expected system admin to see 2 submissions, got %d", len(systemAdminSubmissions))
	}
}
