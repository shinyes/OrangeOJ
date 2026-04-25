package judge

import (
	"context"
	"database/sql"
	"encoding/json"
	"testing"

	dbpkg "orangeoj/backend/internal/db"
	"orangeoj/backend/internal/model"
)

type captureRunner struct {
	lastTask JudgeTask
	result   RunResult
}

func (r *captureRunner) Judge(_ context.Context, task JudgeTask) (RunResult, error) {
	r.lastTask = task
	if len(r.result.CaseResults) == 0 {
		r.result.CaseResults = make([]CaseResult, 0, len(task.Cases))
		for i, tc := range task.Cases {
			r.result.CaseResults = append(r.result.CaseResults, CaseResult{
				CaseNo:         i + 1,
				Verdict:        r.result.Verdict,
				Input:          tc.Input,
				ExpectedOutput: tc.Expected,
			})
		}
	}
	return r.result, nil
}

func TestProcessJob_TestUsesProgrammingTestCases(t *testing.T) {
	db := openQueueTestDB(t)
	defer db.Close()

	body := programmingBody{
		Samples: []programmingCase{
			{Input: "sample-in", Output: "sample-out"},
		},
		TestCases: []programmingCase{
			{Input: "case-1", Output: "out-1"},
			{Input: "case-2", Output: "out-2"},
		},
	}
	submissionID, jobID := seedProgrammingSubmission(t, db, model.SubmitTypeTest, body, "fallback-input")

	runner := &captureRunner{result: RunResult{Verdict: model.VerdictAC}}
	qs := NewQueueService(db, runner, 1)
	if err := qs.processJob(context.Background(), jobItem{ID: jobID, SubmissionID: submissionID}); err != nil {
		t.Fatalf("process job: %v", err)
	}

	if got := len(runner.lastTask.Cases); got != 2 {
		t.Fatalf("expected 2 test cases, got %d", got)
	}
	if runner.lastTask.Cases[0].Input != "case-1" || runner.lastTask.Cases[1].Input != "case-2" {
		t.Fatalf("expected judge task to use testCases, got %+v", runner.lastTask.Cases)
	}
}

func TestProcessJob_TestFallsBackToSamplesWhenNoTestCases(t *testing.T) {
	db := openQueueTestDB(t)
	defer db.Close()

	body := programmingBody{
		Samples: []programmingCase{
			{Input: "sample-1", Output: "sample-out-1"},
			{Input: "sample-2", Output: "sample-out-2"},
		},
	}
	submissionID, jobID := seedProgrammingSubmission(t, db, model.SubmitTypeTest, body, "fallback-input")

	runner := &captureRunner{result: RunResult{Verdict: model.VerdictAC}}
	qs := NewQueueService(db, runner, 1)
	if err := qs.processJob(context.Background(), jobItem{ID: jobID, SubmissionID: submissionID}); err != nil {
		t.Fatalf("process job: %v", err)
	}

	if got := len(runner.lastTask.Cases); got != 2 {
		t.Fatalf("expected 2 sample cases, got %d", got)
	}
	if runner.lastTask.Cases[0].Input != "sample-1" || runner.lastTask.Cases[1].Input != "sample-2" {
		t.Fatalf("expected judge task to fall back to samples, got %+v", runner.lastTask.Cases)
	}
}

func openQueueTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := dbpkg.Open(t.TempDir() + "/queue-process.db")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if _, err := dbpkg.Setup(context.Background(), db, false, "admin123456"); err != nil {
		db.Close()
		t.Fatalf("setup db: %v", err)
	}
	return db
}

func seedProgrammingSubmission(t *testing.T, db *sql.DB, submitType model.SubmitType, body programmingBody, inputData string) (int64, int64) {
	t.Helper()

	bodyJSON, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body json: %v", err)
	}

	if _, err := db.Exec(`INSERT INTO users(username, password_hash, global_role) VALUES('u1', 'x', 'user')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO spaces(name, description, created_by) VALUES('s1', '', 1)`); err != nil {
		t.Fatalf("seed space: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO root_problems(type, title, statement_md, body_json, answer_json, created_by) VALUES('programming', 'p1', 'st', ?, '{}', 1)`, string(bodyJSON)); err != nil {
		t.Fatalf("seed problem: %v", err)
	}

	result, err := db.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, submit_type, status, language, source_code, input_data)
VALUES(1,1,1,'programming',?,'queued','cpp','int main(){return 0;}',?)`, string(submitType), inputData)
	if err != nil {
		t.Fatalf("seed submission: %v", err)
	}
	submissionID, err := result.LastInsertId()
	if err != nil {
		t.Fatalf("submission last insert id: %v", err)
	}

	jobResult, err := db.Exec(`INSERT INTO judge_jobs(submission_id, status, priority) VALUES(?,'queued',0)`, submissionID)
	if err != nil {
		t.Fatalf("seed job: %v", err)
	}
	jobID, err := jobResult.LastInsertId()
	if err != nil {
		t.Fatalf("job last insert id: %v", err)
	}
	return submissionID, jobID
}
