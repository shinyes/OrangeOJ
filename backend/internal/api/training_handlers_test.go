package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"testing"
)

func TestTrainingPlanLifecycle(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "training_admin", "trainadmin123")
	spaceID := mustCreateSpace(t, database, "Training-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")

	problemID1 := mustCreateSpaceProblem(t, database, "Training Problem 1")
	problemID2 := mustCreateSpaceProblem(t, database, "Training Problem 2")

	cookie := mustLogin(t, app, "training_admin", "trainadmin123")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/training-plans", cookie, map[string]interface{}{
		"title":         "Week 1 Training",
		"allowSelfJoin": true,
		"isPublic":      true,
		"published":     true,
		"chapters": []map[string]interface{}{
			{
				"title":      "Basics",
				"orderNo":    1,
				"problemIds": []int64{problemID1, problemID2},
			},
		},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createResp.StatusCode)
	}
	createEnv := decodeEnvelope[map[string]int64](t, createResp)
	planID := createEnv.Data["id"]
	if planID <= 0 {
		t.Fatalf("invalid training plan id: %+v", createEnv.Data)
	}

	getResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(planID), cookie, nil)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected get 200, got %d", getResp.StatusCode)
	}
	getEnv := decodeEnvelope[map[string]interface{}](t, getResp)
	if getEnv.Data["title"] != "Week 1 Training" {
		t.Fatalf("unexpected title: %+v", getEnv.Data["title"])
	}
	if getEnv.Data["published"] != true {
		t.Fatalf("expected published=true, got %+v", getEnv.Data["published"])
	}
	if getEnv.Data["isPublic"] != true {
		t.Fatalf("expected isPublic=true, got %+v", getEnv.Data["isPublic"])
	}
	chapters, ok := getEnv.Data["chapters"].([]interface{})
	if !ok || len(chapters) != 1 {
		t.Fatalf("unexpected chapters: %+v", getEnv.Data["chapters"])
	}
	firstChapter, ok := chapters[0].(map[string]interface{})
	if !ok {
		t.Fatalf("unexpected chapter payload: %+v", chapters[0])
	}
	items, ok := firstChapter["items"].([]interface{})
	if !ok || len(items) != 2 {
		t.Fatalf("unexpected training items: %+v", firstChapter["items"])
	}

	updateResp := doJSONRequest(t, app, http.MethodPut, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(planID), cookie, map[string]interface{}{
		"title":         "Week 1 Updated",
		"allowSelfJoin": false,
		"isPublic":      false,
		"published":     false,
		"chapters": []map[string]interface{}{
			{
				"title":      "Only One",
				"orderNo":    1,
				"problemIds": []int64{problemID2},
			},
		},
	})
	defer updateResp.Body.Close()
	if updateResp.StatusCode != http.StatusOK {
		t.Fatalf("expected update 200, got %d", updateResp.StatusCode)
	}

	verifyResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(planID), cookie, nil)
	if verifyResp.StatusCode != http.StatusOK {
		t.Fatalf("expected verify 200, got %d", verifyResp.StatusCode)
	}
	verifyEnv := decodeEnvelope[map[string]interface{}](t, verifyResp)
	if verifyEnv.Data["title"] != "Week 1 Updated" {
		t.Fatalf("unexpected updated title: %+v", verifyEnv.Data["title"])
	}
	if verifyEnv.Data["published"] != false {
		t.Fatalf("expected published=false, got %+v", verifyEnv.Data["published"])
	}
	if verifyEnv.Data["isPublic"] != false {
		t.Fatalf("expected isPublic=false, got %+v", verifyEnv.Data["isPublic"])
	}

	deleteResp := doJSONRequest(t, app, http.MethodDelete, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(planID), cookie, nil)
	defer deleteResp.Body.Close()
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected delete 200, got %d", deleteResp.StatusCode)
	}

	var count int
	if err := database.QueryRow(`SELECT COUNT(1) FROM training_plans WHERE id=?`, planID).Scan(&count); err != nil {
		t.Fatalf("query training plan: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected training plan deleted, count=%d", count)
	}
}

func TestDeleteTrainingPlanCanDeleteAssociatedProblems(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "training_delete_problem_admin", "trainingdeleteproblem123")
	spaceID := mustCreateSpace(t, database, "Training-Delete-Problem-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")

	exclusiveProblemID := mustCreateSpaceProblem(t, database, "训练独占题目")
	sharedProblemID := mustCreateSpaceProblem(t, database, "训练共享题目")

	targetPlanRes, err := database.Exec(`
INSERT INTO training_plans(space_id, title, allow_self_join, is_public)
VALUES(?, '待删除训练', 1, 1)`, spaceID)
	if err != nil {
		t.Fatalf("create target plan: %v", err)
	}
	targetPlanID, _ := targetPlanRes.LastInsertId()
	targetChapterRes, err := database.Exec(`
INSERT INTO training_chapters(plan_id, title, order_no)
VALUES(?, '第一章', 1)`, targetPlanID)
	if err != nil {
		t.Fatalf("create target chapter: %v", err)
	}
	targetChapterID, _ := targetChapterRes.LastInsertId()
	if _, err := database.Exec(`
INSERT INTO training_items(chapter_id, problem_id, order_no)
VALUES(?, ?, 1), (?, ?, 2)`, targetChapterID, exclusiveProblemID, targetChapterID, sharedProblemID); err != nil {
		t.Fatalf("create target training items: %v", err)
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

	otherPlanRes, err := database.Exec(`
INSERT INTO training_plans(space_id, title, allow_self_join, is_public)
VALUES(?, '保留训练', 1, 1)`, spaceID)
	if err != nil {
		t.Fatalf("create other plan: %v", err)
	}
	otherPlanID, _ := otherPlanRes.LastInsertId()
	otherChapterRes, err := database.Exec(`
INSERT INTO training_chapters(plan_id, title, order_no)
VALUES(?, '第一章', 1)`, otherPlanID)
	if err != nil {
		t.Fatalf("create other chapter: %v", err)
	}
	otherChapterID, _ := otherChapterRes.LastInsertId()
	if _, err := database.Exec(`
INSERT INTO training_items(chapter_id, problem_id, order_no)
VALUES(?, ?, 1)`, otherChapterID, sharedProblemID); err != nil {
		t.Fatalf("create other training item: %v", err)
	}

	cookie := mustLogin(t, app, "training_delete_problem_admin", "trainingdeleteproblem123")
	deleteResp := doJSONRequest(t, app, http.MethodDelete, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(targetPlanID)+"?deleteProblems=1", cookie, nil)
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
}

func TestCreateTrainingPlanWithProblemDrafts(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "training_import_admin", "trainimport123")
	spaceID := mustCreateSpace(t, database, "Training-Import-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")

	cookie := mustLogin(t, app, "training_import_admin", "trainimport123")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/training-plans", cookie, map[string]interface{}{
		"title":         "Imported Training",
		"allowSelfJoin": true,
		"isPublic":      true,
		"published":     true,
		"chapters": []map[string]interface{}{
			{
				"title":   "导入章节",
				"orderNo": 1,
				"problemDrafts": []map[string]interface{}{
					{
						"type":        "single_choice",
						"title":       "选择题 1",
						"statementMd": "从导入创建的选择题",
						"bodyJson": map[string]interface{}{
							"options": []string{"A", "B", "C", "D"},
						},
						"answerJson": map[string]interface{}{
							"correctIndex": 2,
						},
					},
					{
						"type":           "programming",
						"title":          "编程题 1",
						"statementMd":    "从导入创建的编程题",
						"bodyJson":       map[string]interface{}{},
						"answerJson":     map[string]interface{}{},
						"timeLimitMs":    2000,
						"memoryLimitMiB": 512,
					},
				},
			},
		},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createResp.StatusCode)
	}
	createEnv := decodeEnvelope[map[string]int64](t, createResp)
	planID := createEnv.Data["id"]
	if planID <= 0 {
		t.Fatalf("invalid training plan id: %+v", createEnv.Data)
	}

	getResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(planID), cookie, nil)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected get 200, got %d", getResp.StatusCode)
	}
	getEnv := decodeEnvelope[map[string]interface{}](t, getResp)
	chapters, ok := getEnv.Data["chapters"].([]interface{})
	if !ok || len(chapters) != 1 {
		t.Fatalf("unexpected chapters: %+v", getEnv.Data["chapters"])
	}
	firstChapter, ok := chapters[0].(map[string]interface{})
	if !ok {
		t.Fatalf("unexpected chapter payload: %+v", chapters[0])
	}
	items, ok := firstChapter["items"].([]interface{})
	if !ok || len(items) != 2 {
		t.Fatalf("unexpected training items: %+v", firstChapter["items"])
	}

	var problemCount int
	if err := database.QueryRow(`SELECT COUNT(1) FROM space_problems WHERE space_id=?`, spaceID).Scan(&problemCount); err != nil {
		t.Fatalf("count created problems: %v", err)
	}
	if problemCount != 2 {
		t.Fatalf("expected 2 created problems, got %d", problemCount)
	}

	var importedAnswerJSON string
	if err := database.QueryRow(`SELECT answer_json FROM space_problems WHERE space_id=? AND title=?`, spaceID, "选择题 1").Scan(&importedAnswerJSON); err != nil {
		t.Fatalf("query imported answer json: %v", err)
	}
	var importedAnswer map[string]interface{}
	if err := json.Unmarshal([]byte(importedAnswerJSON), &importedAnswer); err != nil {
		t.Fatalf("decode imported answer json: %v", err)
	}
	if importedAnswer["answer"] != "C" {
		t.Fatalf("expected imported answer C, got %+v", importedAnswer)
	}
}

func TestJoinTrainingPlanRespectsAllowSelfJoin(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "join_admin", "joinadmin123")
	memberID := seedUser(t, database, "join_member", "joinmember123")
	spaceID := mustCreateSpace(t, database, "Join-Training-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberID, "member")

	cookie := mustLogin(t, app, "join_admin", "joinadmin123")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/training-plans", cookie, map[string]interface{}{
		"title":         "Admin Assigned Training",
		"allowSelfJoin": false,
		"isPublic":      true,
		"published":     true,
		"chapters":      []map[string]interface{}{},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createResp.StatusCode)
	}
	createEnv := decodeEnvelope[map[string]int64](t, createResp)
	planID := createEnv.Data["id"]

	memberCookie := mustLogin(t, app, "join_member", "joinmember123")
	joinResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(planID)+"/join", memberCookie, nil)
	defer joinResp.Body.Close()
	if joinResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected join 403, got %d", joinResp.StatusCode)
	}

	assignResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(planID)+"/participants", cookie, map[string]int64{
		"userId": memberID,
	})
	defer assignResp.Body.Close()
	if assignResp.StatusCode != http.StatusOK {
		t.Fatalf("expected assign 200, got %d", assignResp.StatusCode)
	}

	var count int
	if err := database.QueryRow(`SELECT COUNT(1) FROM training_participants WHERE plan_id=? AND user_id=?`, planID, memberID).Scan(&count); err != nil {
		t.Fatalf("query participant: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected participant inserted, count=%d", count)
	}
}

func TestTrainingPlanVisibilityRules(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "visibility_admin", "visibilityadmin123")
	memberVisibleID := seedUser(t, database, "visibility_member_visible", "visiblemember123")
	memberHiddenID := seedUser(t, database, "visibility_member_hidden", "hiddenmember123")
	spaceID := mustCreateSpace(t, database, "Visibility-Training-Space")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberVisibleID, "member")
	mustAddMember(t, database, spaceID, memberHiddenID, "member")

	adminCookie := mustLogin(t, app, "visibility_admin", "visibilityadmin123")

	createPlan := func(title string, isPublic bool) int64 {
		resp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/training-plans", adminCookie, map[string]interface{}{
			"title":         title,
			"allowSelfJoin": true,
			"isPublic":      isPublic,
			"published":     true,
			"chapters":      []map[string]interface{}{},
		})
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected create 200 for %s, got %d", title, resp.StatusCode)
		}
		env := decodeEnvelope[map[string]int64](t, resp)
		return env.Data["id"]
	}

	publicPlanID := createPlan("Public Training", true)
	hiddenAssignedPlanID := createPlan("Hidden Assigned Training", false)
	hiddenUnassignedPlanID := createPlan("Hidden Unassigned Training", false)

	assignResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(hiddenAssignedPlanID)+"/participants", adminCookie, map[string]int64{
		"userId": memberVisibleID,
	})
	if assignResp.StatusCode != http.StatusOK {
		t.Fatalf("expected assign 200, got %d", assignResp.StatusCode)
	}
	assignResp.Body.Close()

	listRespAdmin := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/training-plans", adminCookie, nil)
	if listRespAdmin.StatusCode != http.StatusOK {
		t.Fatalf("expected admin list 200, got %d", listRespAdmin.StatusCode)
	}
	adminPlans := decodeEnvelope[[]map[string]interface{}](t, listRespAdmin).Data
	if len(adminPlans) != 3 {
		t.Fatalf("expected admin to see 3 plans, got %d", len(adminPlans))
	}

	memberVisibleCookie := mustLogin(t, app, "visibility_member_visible", "visiblemember123")
	listRespVisible := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/training-plans", memberVisibleCookie, nil)
	if listRespVisible.StatusCode != http.StatusOK {
		t.Fatalf("expected visible member list 200, got %d", listRespVisible.StatusCode)
	}
	visiblePlans := decodeEnvelope[[]map[string]interface{}](t, listRespVisible).Data
	if len(visiblePlans) != 2 {
		t.Fatalf("expected visible member to see 2 plans, got %d", len(visiblePlans))
	}
	joinedByPlanID := map[int64]bool{}
	for _, plan := range visiblePlans {
		id, _ := plan["id"].(float64)
		joined, _ := plan["joined"].(bool)
		joinedByPlanID[int64(id)] = joined
	}
	if joinedByPlanID[hiddenAssignedPlanID] != true {
		t.Fatalf("expected assigned hidden plan joined=true, got %+v", joinedByPlanID)
	}
	if joinedByPlanID[publicPlanID] != false {
		t.Fatalf("expected public unjoined plan joined=false, got %+v", joinedByPlanID)
	}

	memberHiddenCookie := mustLogin(t, app, "visibility_member_hidden", "hiddenmember123")
	listRespHidden := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/training-plans", memberHiddenCookie, nil)
	if listRespHidden.StatusCode != http.StatusOK {
		t.Fatalf("expected hidden member list 200, got %d", listRespHidden.StatusCode)
	}
	hiddenPlans := decodeEnvelope[[]map[string]interface{}](t, listRespHidden).Data
	if len(hiddenPlans) != 1 {
		t.Fatalf("expected hidden member to see 1 plan, got %d", len(hiddenPlans))
	}

	visibleGetResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(hiddenAssignedPlanID), memberVisibleCookie, nil)
	if visibleGetResp.StatusCode != http.StatusOK {
		t.Fatalf("expected assigned hidden plan get 200, got %d", visibleGetResp.StatusCode)
	}
	visibleGetResp.Body.Close()

	hiddenGetResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(hiddenAssignedPlanID), memberHiddenCookie, nil)
	if hiddenGetResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected hidden unassigned get 404, got %d", hiddenGetResp.StatusCode)
	}
	hiddenGetResp.Body.Close()

	hiddenJoinResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(hiddenUnassignedPlanID)+"/join", memberHiddenCookie, nil)
	if hiddenJoinResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected hidden unassigned join 404, got %d", hiddenJoinResp.StatusCode)
	}
	hiddenJoinResp.Body.Close()

	publicJoinResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(publicPlanID)+"/join", memberHiddenCookie, nil)
	if publicJoinResp.StatusCode != http.StatusOK {
		t.Fatalf("expected public join 200, got %d", publicJoinResp.StatusCode)
	}
	publicJoinResp.Body.Close()
}

func TestTrainingPlanIncludesProblemCompletionState(t *testing.T) {
	app, database := newTestApp(t, false)

	memberID := seedUser(t, database, "training_progress_member", "trainingprogress123")
	spaceID := mustCreateSpace(t, database, "Training-Progress-Space")
	mustAddMember(t, database, spaceID, memberID, "member")

	problemID1 := mustCreateSpaceProblem(t, database, "训练已完成题目")
	problemID2 := mustCreateSpaceProblem(t, database, "训练未完成题目")

	adminCookie := mustLogin(t, app, "admin", "admin123456")
	createResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+itoa(spaceID)+"/training-plans", adminCookie, map[string]interface{}{
		"title":         "带完成状态的训练",
		"allowSelfJoin": true,
		"isPublic":      true,
		"published":     true,
		"chapters": []map[string]interface{}{
			{
				"title":      "第一章",
				"orderNo":    1,
				"problemIds": []int64{problemID1, problemID2},
			},
		},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createResp.StatusCode)
	}
	planID := decodeEnvelope[map[string]int64](t, createResp).Data["id"]

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

	memberCookie := mustLogin(t, app, "training_progress_member", "trainingprogress123")
	getResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+itoa(spaceID)+"/training-plans/"+itoa(planID), memberCookie, nil)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected get 200, got %d", getResp.StatusCode)
	}
	getEnv := decodeEnvelope[map[string]interface{}](t, getResp)
	chapters, ok := getEnv.Data["chapters"].([]interface{})
	if !ok || len(chapters) != 1 {
		t.Fatalf("unexpected chapters: %+v", getEnv.Data["chapters"])
	}
	firstChapter, ok := chapters[0].(map[string]interface{})
	if !ok {
		t.Fatalf("unexpected chapter payload: %+v", chapters[0])
	}
	items, ok := firstChapter["items"].([]interface{})
	if !ok || len(items) != 2 {
		t.Fatalf("unexpected items: %+v", firstChapter["items"])
	}

	completedByID := map[int64]bool{}
	for _, raw := range items {
		item, ok := raw.(map[string]interface{})
		if !ok {
			t.Fatalf("unexpected item payload: %+v", raw)
		}
		id, _ := item["problemId"].(float64)
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

func mustCreateSpaceProblem(t *testing.T, database *sql.DB, title string) int64 {
	t.Helper()
	var spaceID int64
	if err := database.QueryRow(`SELECT COALESCE(MAX(id), 0) FROM spaces`).Scan(&spaceID); err != nil {
		t.Fatalf("find latest space: %v", err)
	}
	if spaceID <= 0 {
		t.Fatalf("must create space before creating problem")
	}
	res, err := database.Exec(`
INSERT INTO space_problems(space_id, type, title, statement_md, body_json, answer_json, created_by)
VALUES(?, 'programming', ?, 'statement', '{}', '{}', 1)`, spaceID, title)
	if err != nil {
		t.Fatalf("create root problem: %v", err)
	}
	id, _ := res.LastInsertId()
	return id
}
