package judge

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"orangeoj/backend/internal/model"
)

type QueueService struct {
	db      *sql.DB
	runner  *DockerRunner
	workers int
}

type jobItem struct {
	ID           int64
	SubmissionID int64
}

type programmingBody struct {
	InputFormat  string            `json:"inputFormat"`
	OutputFormat string            `json:"outputFormat"`
	Samples      []programmingCase `json:"samples"`
	TestCases    []programmingCase `json:"testCases"`
}

type programmingCase struct {
	Input  string `json:"input"`
	Output string `json:"output"`
}

type runtimeSubmission struct {
	ID             int64
	UserID         int64
	SpaceID        int64
	ProblemID      int64
	SubmitType     model.SubmitType
	Language       string
	SourceCode     string
	InputData      string
	TimeLimitMS    int
	MemoryLimitMiB int
	BodyJSON       string
}

func NewQueueService(db *sql.DB, runner *DockerRunner, workers int) *QueueService {
	if workers < 1 {
		workers = 1
	}
	return &QueueService{db: db, runner: runner, workers: workers}
}

func (q *QueueService) Start(ctx context.Context) {
	for i := 0; i < q.workers; i++ {
		go q.workerLoop(ctx, i+1)
	}
}

func (q *QueueService) workerLoop(ctx context.Context, idx int) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		job, err := q.claimJob(ctx)
		if err != nil {
			log.Printf("[judge-worker-%d] claim error: %v", idx, err)
			time.Sleep(800 * time.Millisecond)
			continue
		}
		if job == nil {
			time.Sleep(400 * time.Millisecond)
			continue
		}

		if err := q.processJob(ctx, *job); err != nil {
			log.Printf("[judge-worker-%d] process job %d failed: %v", idx, job.ID, err)
			_ = q.failJob(context.Background(), job.ID, err)
		}
	}
}

func (q *QueueService) claimJob(ctx context.Context) (*jobItem, error) {
	tx, err := q.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	row := tx.QueryRowContext(ctx, `
WITH cte AS (
	SELECT id
	FROM judge_jobs
	WHERE status='queued' AND datetime(available_at) <= datetime('now')
	ORDER BY priority DESC, id ASC
	LIMIT 1
)
UPDATE judge_jobs
SET status='running', started_at=CURRENT_TIMESTAMP, worker_token=?
WHERE id=(SELECT id FROM cte)
RETURNING id, submission_id`, uuid.NewString())

	item := &jobItem{}
	if err := row.Scan(&item.ID, &item.SubmissionID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, tx.Commit()
		}
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return item, nil
}

func (q *QueueService) processJob(ctx context.Context, job jobItem) error {
	if _, err := q.db.ExecContext(ctx, `UPDATE submissions SET status='running' WHERE id=?`, job.SubmissionID); err != nil {
		return err
	}

	sub, err := q.loadSubmission(ctx, job.SubmissionID)
	if err != nil {
		return err
	}

	body := programmingBody{}
	if err := json.Unmarshal([]byte(sub.BodyJSON), &body); err != nil {
		body = programmingBody{}
	}

	finalVerdict := model.VerdictAC
	totalStdout := strings.Builder{}
	totalStderr := strings.Builder{}
	maxTimeMS := 0
	score := 0

	var cases []programmingCase
	switch sub.SubmitType {
	case model.SubmitTypeRun:
		cases = []programmingCase{{Input: sub.InputData}}
	case model.SubmitTypeTest:
		cases = body.Samples
		if len(cases) == 0 {
			cases = []programmingCase{{Input: sub.InputData}}
		}
	case model.SubmitTypeSubmit:
		cases = body.TestCases
		if len(cases) == 0 {
			cases = body.Samples
		}
	default:
		cases = []programmingCase{{Input: sub.InputData}}
	}
	if len(cases) == 0 {
		cases = []programmingCase{{Input: "", Output: ""}}
	}

	for i, tc := range cases {
		res := q.runner.Run(ctx, sub.ID, sub.Language, sub.SourceCode, tc.Input, sub.TimeLimitMS, sub.MemoryLimitMiB)
		if res.TimeMS > maxTimeMS {
			maxTimeMS = res.TimeMS
		}
		totalStdout.WriteString(fmt.Sprintf("[case %d stdout]\n%s\n", i+1, res.Stdout))
		if res.Stderr != "" {
			totalStderr.WriteString(fmt.Sprintf("[case %d stderr]\n%s\n", i+1, res.Stderr))
		}

		if res.Verdict != model.VerdictOK {
			finalVerdict = res.Verdict
			break
		}

		if sub.SubmitType == model.SubmitTypeTest || sub.SubmitType == model.SubmitTypeSubmit {
			if NormalizeOutput(res.Stdout) != NormalizeOutput(tc.Output) {
				finalVerdict = model.VerdictWA
				totalStderr.WriteString(fmt.Sprintf("[case %d] expected:\n%s\n", i+1, tc.Output))
				break
			}
		}
	}

	if sub.SubmitType == model.SubmitTypeRun {
		if finalVerdict == model.VerdictAC {
			finalVerdict = model.VerdictOK
		}
	}

	if sub.SubmitType == model.SubmitTypeSubmit {
		if finalVerdict == model.VerdictAC {
			score = 100
		} else {
			score = 0
		}
	} else if sub.SubmitType == model.SubmitTypeTest {
		if finalVerdict == model.VerdictAC {
			score = 100
		}
	}

	if err := q.finishSubmission(ctx, sub, finalVerdict, maxTimeMS, sub.MemoryLimitMiB*1024, score, totalStdout.String(), totalStderr.String()); err != nil {
		return err
	}
	if err := q.completeJob(ctx, job.ID); err != nil {
		return err
	}
	return nil
}

func (q *QueueService) loadSubmission(ctx context.Context, submissionID int64) (*runtimeSubmission, error) {
	row := q.db.QueryRowContext(ctx, `
SELECT s.id, s.user_id, s.space_id, s.problem_id, s.submit_type, s.language, s.source_code, s.input_data,
       p.time_limit_ms, p.memory_limit_mib, p.body_json
FROM submissions s
JOIN root_problems p ON p.id = s.problem_id
WHERE s.id = ?`, submissionID)

	s := &runtimeSubmission{}
	if err := row.Scan(&s.ID, &s.UserID, &s.SpaceID, &s.ProblemID, &s.SubmitType, &s.Language, &s.SourceCode, &s.InputData, &s.TimeLimitMS, &s.MemoryLimitMiB, &s.BodyJSON); err != nil {
		return nil, err
	}
	return s, nil
}

func (q *QueueService) finishSubmission(ctx context.Context, sub *runtimeSubmission, verdict model.Verdict, timeMS, memoryKiB, score int, stdout, stderr string) error {
	_, err := q.db.ExecContext(ctx, `
UPDATE submissions
SET status='done', verdict=?, time_ms=?, memory_kib=?, score=?, stdout=?, stderr=?, finished_at=CURRENT_TIMESTAMP
WHERE id=?`, string(verdict), timeMS, memoryKiB, score, stdout, stderr, sub.ID)
	if err != nil {
		return err
	}

	if sub.SubmitType == model.SubmitTypeSubmit {
		if _, err := q.db.ExecContext(ctx, `
INSERT INTO user_problem_progress(space_id, user_id, problem_id, best_verdict, best_score, last_submission_id, updated_at)
VALUES(?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(space_id, user_id, problem_id)
DO UPDATE SET
	best_verdict=CASE WHEN excluded.best_score >= user_problem_progress.best_score THEN excluded.best_verdict ELSE user_problem_progress.best_verdict END,
	best_score=CASE WHEN excluded.best_score >= user_problem_progress.best_score THEN excluded.best_score ELSE user_problem_progress.best_score END,
	last_submission_id=excluded.last_submission_id,
	updated_at=CURRENT_TIMESTAMP`, sub.SpaceID, sub.UserID, sub.ProblemID, string(verdict), score, sub.ID); err != nil {
			return err
		}
	}
	return nil
}

func (q *QueueService) completeJob(ctx context.Context, jobID int64) error {
	_, err := q.db.ExecContext(ctx, `UPDATE judge_jobs SET status='done', finished_at=CURRENT_TIMESTAMP WHERE id=?`, jobID)
	return err
}

func (q *QueueService) failJob(ctx context.Context, jobID int64, jobErr error) error {
	_, err := q.db.ExecContext(ctx, `UPDATE judge_jobs SET status='failed', finished_at=CURRENT_TIMESTAMP WHERE id=?`, jobID)
	if err != nil {
		return err
	}
	_, _ = q.db.ExecContext(ctx, `
UPDATE submissions
SET status='failed', verdict='RE', stderr=?, finished_at=CURRENT_TIMESTAMP
WHERE id=(SELECT submission_id FROM judge_jobs WHERE id=?)`, trimTo(jobErr.Error(), 4000), jobID)
	return nil
}

func EnqueueSubmission(ctx context.Context, db *sql.DB, submissionID int64, priority int) error {
	_, err := db.ExecContext(ctx, `
INSERT INTO judge_jobs(submission_id, status, priority, available_at)
VALUES(?, 'queued', ?, CURRENT_TIMESTAMP)`, submissionID, priority)
	return err
}
