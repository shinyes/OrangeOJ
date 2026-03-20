package judge

import (
	"context"
	"database/sql"
	"sync"
	"testing"

	dbpkg "orangeoj/backend/internal/db"
)

func TestClaimJobAtomic(t *testing.T) {
	db, err := dbpkg.Open(t.TempDir() + "/queue.db")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()
	if _, err := dbpkg.Setup(context.Background(), db, false, "admin123456"); err != nil {
		t.Fatalf("setup db: %v", err)
	}

	seedQueueFixture(t, db)

	qs := NewQueueService(db, nil, 1)
	var wg sync.WaitGroup
	results := make(chan *jobItem, 2)

	wg.Add(2)
	for i := 0; i < 2; i++ {
		go func() {
			defer wg.Done()
			job, _ := qs.claimJob(context.Background())
			results <- job
		}()
	}
	wg.Wait()
	close(results)

	claimed := 0
	for job := range results {
		if job != nil {
			claimed++
		}
	}
	if claimed != 1 {
		t.Fatalf("expected one claim, got %d", claimed)
	}
}

func seedQueueFixture(t *testing.T, db *sql.DB) {
	_, err := db.Exec(`INSERT INTO users(username, password_hash, global_role) VALUES('u1', 'x', 'user')`)
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	_, err = db.Exec(`INSERT INTO spaces(name, description, created_by) VALUES('s1', '', 1)`)
	if err != nil {
		t.Fatalf("seed space: %v", err)
	}
	_, err = db.Exec(`INSERT INTO root_problems(type, title, statement_md, body_json, answer_json, created_by) VALUES('programming', 'p1', 'st', '{}', '{}', 1)`)
	if err != nil {
		t.Fatalf("seed problem: %v", err)
	}
	_, err = db.Exec(`INSERT INTO submissions(user_id, space_id, problem_id, question_type, submit_type, status) VALUES(1,1,1,'programming','submit','queued')`)
	if err != nil {
		t.Fatalf("seed submission: %v", err)
	}
	_, err = db.Exec(`INSERT INTO judge_jobs(submission_id, status, priority) VALUES(1,'queued',0)`)
	if err != nil {
		t.Fatalf("seed job: %v", err)
	}
}
