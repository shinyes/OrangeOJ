package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

type SetupResult struct {
	AdminPasswordGenerated string
}

func Open(dbPath string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("create db directory: %w", err)
	}
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)", filepath.ToSlash(dbPath))
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetConnMaxLifetime(0)
	if err := db.Ping(); err != nil {
		return nil, err
	}
	if _, err := db.Exec(`PRAGMA journal_mode=WAL;`); err != nil {
		return nil, err
	}
	return db, nil
}

func Setup(ctx context.Context, db *sql.DB, registrationDefault bool, adminPasswordOverride string) (*SetupResult, error) {
	if err := migrate(ctx, db); err != nil {
		return nil, err
	}
	if err := ensureSetting(ctx, db, "registration_enabled", boolToSetting(registrationDefault)); err != nil {
		return nil, err
	}
	generated, err := ensureAdmin(ctx, db, adminPasswordOverride)
	if err != nil {
		return nil, err
	}
	if err := recoverStaleJobs(ctx, db); err != nil {
		return nil, err
	}
	return &SetupResult{AdminPasswordGenerated: generated}, nil
}

func migrate(ctx context.Context, db *sql.DB) error {
	if err := migrateLegacyProblemTable(ctx, db); err != nil {
		return err
	}
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			global_role TEXT NOT NULL DEFAULT 'user',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS system_settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS spaces (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			description TEXT NOT NULL DEFAULT '',
			default_programming_language TEXT NOT NULL DEFAULT 'cpp',
			created_by INTEGER NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(created_by) REFERENCES users(id)
		);`,
		`CREATE TABLE IF NOT EXISTS space_members (
			space_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY(space_id, user_id),
			FOREIGN KEY(space_id) REFERENCES spaces(id) ON DELETE CASCADE,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS space_problems (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			space_id INTEGER NOT NULL,
			type TEXT NOT NULL,
			title TEXT NOT NULL,
			tags_json TEXT NOT NULL DEFAULT '[]',
			statement_md TEXT NOT NULL,
			body_json TEXT NOT NULL,
			answer_json TEXT NOT NULL,
			time_limit_ms INTEGER NOT NULL DEFAULT 1000,
			memory_limit_mib INTEGER NOT NULL DEFAULT 256,
			created_by INTEGER NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(space_id) REFERENCES spaces(id) ON DELETE CASCADE,
			FOREIGN KEY(created_by) REFERENCES users(id)
		);`,
		`CREATE TABLE IF NOT EXISTS training_plans (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			space_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			allow_self_join INTEGER NOT NULL DEFAULT 0,
			published_at DATETIME,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(space_id) REFERENCES spaces(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS training_chapters (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			plan_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			order_no INTEGER NOT NULL,
			FOREIGN KEY(plan_id) REFERENCES training_plans(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS training_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			chapter_id INTEGER NOT NULL,
			problem_id INTEGER NOT NULL,
			order_no INTEGER NOT NULL,
			FOREIGN KEY(chapter_id) REFERENCES training_chapters(id) ON DELETE CASCADE,
			FOREIGN KEY(problem_id) REFERENCES space_problems(id)
		);`,
		`CREATE TABLE IF NOT EXISTS training_participants (
			plan_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			joined_by TEXT NOT NULL,
			joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY(plan_id, user_id),
			FOREIGN KEY(plan_id) REFERENCES training_plans(id) ON DELETE CASCADE,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS homeworks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			space_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			due_at DATETIME,
			display_mode TEXT NOT NULL DEFAULT 'exam',
			created_by INTEGER NOT NULL,
			published INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(space_id) REFERENCES spaces(id) ON DELETE CASCADE,
			FOREIGN KEY(created_by) REFERENCES users(id)
		);`,
		`CREATE TABLE IF NOT EXISTS homework_items (
			homework_id INTEGER NOT NULL,
			problem_id INTEGER NOT NULL,
			order_no INTEGER NOT NULL,
			score INTEGER NOT NULL DEFAULT 100,
			PRIMARY KEY(homework_id, problem_id),
			FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE,
			FOREIGN KEY(problem_id) REFERENCES space_problems(id)
		);`,
		`CREATE TABLE IF NOT EXISTS homework_targets (
			homework_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			PRIMARY KEY(homework_id, user_id),
			FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS homework_submission_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			homework_id INTEGER NOT NULL,
			space_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			homework_item_count INTEGER NOT NULL DEFAULT 0,
			homework_total_score INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE,
			FOREIGN KEY(space_id) REFERENCES spaces(id) ON DELETE CASCADE,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS homework_submission_record_items (
			record_id INTEGER NOT NULL,
			problem_id INTEGER NOT NULL,
			submission_id INTEGER NOT NULL,
			order_no INTEGER NOT NULL,
			item_score INTEGER NOT NULL DEFAULT 0,
			problem_title TEXT NOT NULL DEFAULT '',
			problem_type TEXT NOT NULL DEFAULT '',
			PRIMARY KEY(record_id, problem_id),
			FOREIGN KEY(record_id) REFERENCES homework_submission_records(id) ON DELETE CASCADE,
			FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS submissions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			space_id INTEGER NOT NULL,
			problem_id INTEGER NOT NULL,
			question_type TEXT NOT NULL,
			language TEXT NOT NULL DEFAULT '',
			source_code TEXT NOT NULL DEFAULT '',
			input_data TEXT NOT NULL DEFAULT '',
			submit_type TEXT NOT NULL,
			status TEXT NOT NULL,
			verdict TEXT NOT NULL DEFAULT 'PENDING',
			time_ms INTEGER NOT NULL DEFAULT 0,
			memory_kib INTEGER NOT NULL DEFAULT 0,
			score INTEGER NOT NULL DEFAULT 0,
			stdout TEXT NOT NULL DEFAULT '',
			stderr TEXT NOT NULL DEFAULT '',
			case_details_json TEXT NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			finished_at DATETIME,
			FOREIGN KEY(user_id) REFERENCES users(id),
			FOREIGN KEY(space_id) REFERENCES spaces(id),
			FOREIGN KEY(problem_id) REFERENCES space_problems(id)
		);`,
		`CREATE TABLE IF NOT EXISTS judge_jobs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			submission_id INTEGER NOT NULL UNIQUE,
			status TEXT NOT NULL,
			priority INTEGER NOT NULL DEFAULT 0,
			available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			started_at DATETIME,
			finished_at DATETIME,
			worker_token TEXT,
			FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
		);`,
		`CREATE INDEX IF NOT EXISTS idx_judge_jobs_status_priority ON judge_jobs(status, priority DESC, id ASC);`,
		`CREATE INDEX IF NOT EXISTS idx_homework_submission_records_lookup ON homework_submission_records(homework_id, user_id, id DESC);`,
		`CREATE TABLE IF NOT EXISTS user_problem_progress (
			space_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			problem_id INTEGER NOT NULL,
			best_verdict TEXT NOT NULL,
			best_score INTEGER NOT NULL DEFAULT 0,
			last_submission_id INTEGER NOT NULL,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY(space_id, user_id, problem_id),
			FOREIGN KEY(last_submission_id) REFERENCES submissions(id)
		);`,
		`CREATE TABLE IF NOT EXISTS image_tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			color TEXT NOT NULL DEFAULT '#3498db',
			created_by INTEGER NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(created_by) REFERENCES users(id)
		);`,
		`CREATE TABLE IF NOT EXISTS image_tag_links (
			image_url TEXT NOT NULL,
			tag_id INTEGER NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY(image_url, tag_id),
			FOREIGN KEY(tag_id) REFERENCES image_tags(id) ON DELETE CASCADE
		);`,
		`CREATE INDEX IF NOT EXISTS idx_image_tag_links_tag_id ON image_tag_links(tag_id);`,
		`CREATE TABLE IF NOT EXISTS homework_drafts (
			user_id INTEGER NOT NULL,
			space_id INTEGER NOT NULL,
			homework_id INTEGER NOT NULL,
			draft_json TEXT NOT NULL,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY(user_id, space_id, homework_id),
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY(space_id) REFERENCES spaces(id) ON DELETE CASCADE,
			FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE
		);`,
	}
	for _, stmt := range stmts {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("migrate failed: %w; stmt: %s", err, stmt)
		}
	}
	if err := addColumnIfNotExists(ctx, db, "spaces", "default_programming_language", "TEXT NOT NULL DEFAULT 'cpp'"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(ctx, db, "space_problems", "space_id", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(ctx, db, "space_problems", "tags_json", "TEXT NOT NULL DEFAULT '[]'"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(ctx, db, "homeworks", "display_mode", "TEXT NOT NULL DEFAULT 'exam'"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(ctx, db, "training_plans", "is_public", "INTEGER NOT NULL DEFAULT 1"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(ctx, db, "submissions", "case_details_json", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if _, err := db.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS idx_space_problems_space_id ON space_problems(space_id, id DESC);`); err != nil {
		return fmt.Errorf("migrate failed: %w; stmt: CREATE INDEX IF NOT EXISTS idx_space_problems_space_id ON space_problems(space_id, id DESC);", err)
	}
	return nil
}

func migrateLegacyProblemTable(ctx context.Context, db *sql.DB) error {
	legacyExists, err := tableExists(ctx, db, "root_problems")
	if err != nil {
		return err
	}
	if !legacyExists {
		return nil
	}

	currentExists, err := tableExists(ctx, db, "space_problems")
	if err != nil {
		return err
	}
	if !currentExists {
		if _, err := db.ExecContext(ctx, `ALTER TABLE root_problems RENAME TO space_problems`); err != nil {
			return fmt.Errorf("rename root_problems to space_problems failed: %w", err)
		}
		return nil
	}

	legacyCount, err := tableRowCount(ctx, db, "root_problems")
	if err != nil {
		return err
	}
	if legacyCount == 0 {
		if _, err := db.ExecContext(ctx, `DROP TABLE root_problems`); err != nil {
			return fmt.Errorf("drop empty legacy root_problems failed: %w", err)
		}
		return nil
	}

	currentCount, err := tableRowCount(ctx, db, "space_problems")
	if err != nil {
		return err
	}
	if currentCount != 0 {
		return fmt.Errorf("legacy root_problems still has %d rows while space_problems already has %d rows; clean up the old table manually", legacyCount, currentCount)
	}

	if _, err := db.ExecContext(ctx, `
INSERT INTO space_problems(id, space_id, type, title, tags_json, statement_md, body_json, answer_json, time_limit_ms, memory_limit_mib, created_by, created_at)
SELECT id, space_id, type, title, tags_json, statement_md, body_json, answer_json, time_limit_ms, memory_limit_mib, created_by, created_at
FROM root_problems`); err != nil {
		return fmt.Errorf("copy legacy root_problems data failed: %w", err)
	}
	if _, err := db.ExecContext(ctx, `DROP TABLE root_problems`); err != nil {
		return fmt.Errorf("drop legacy root_problems after copy failed: %w", err)
	}
	return nil
}

func dropColumnIfExists(ctx context.Context, db *sql.DB, table, column string) error {
	stmt := fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s", table, column)
	if _, err := db.ExecContext(ctx, stmt); err != nil {
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "unknown column") || strings.Contains(msg, "duplicate column name") {
			return nil
		}
		return fmt.Errorf("drop column %s.%s failed: %w", table, column, err)
	}
	return nil
}

func addColumnIfNotExists(ctx context.Context, db *sql.DB, table, column, definition string) error {
	stmt := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, definition)
	if _, err := db.ExecContext(ctx, stmt); err != nil {
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "duplicate column name") {
			return nil
		}
		return fmt.Errorf("add column %s.%s failed: %w", table, column, err)
	}
	return nil
}

func tableExists(ctx context.Context, db *sql.DB, table string) (bool, error) {
	var name string
	err := db.QueryRowContext(ctx, `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, table).Scan(&name)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("check table %s failed: %w", table, err)
	}
	return true, nil
}

func tableRowCount(ctx context.Context, db *sql.DB, table string) (int64, error) {
	var count int64
	query := fmt.Sprintf("SELECT COUNT(1) FROM %s", table)
	if err := db.QueryRowContext(ctx, query).Scan(&count); err != nil {
		return 0, fmt.Errorf("count rows in %s failed: %w", table, err)
	}
	return count, nil
}

func ensureSetting(ctx context.Context, db *sql.DB, key, value string) error {
	_, err := db.ExecContext(ctx, `INSERT INTO system_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO NOTHING`, key, value)
	return err
}

func ensureAdmin(ctx context.Context, db *sql.DB, passwordOverride string) (string, error) {
	var count int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(1) FROM users WHERE username='admin'`).Scan(&count); err != nil {
		return "", err
	}
	if count > 0 {
		return "", nil
	}

	password := passwordOverride
	generated := ""
	if password == "" {
		password = "OrangeOJ-" + uuid.NewString()[:12]
		generated = password
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	_, err = db.ExecContext(ctx, `INSERT INTO users(username, password_hash, global_role) VALUES('admin', ?, 'system_admin')`, string(hashed))
	if err != nil {
		return "", err
	}
	return generated, nil
}

func recoverStaleJobs(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `UPDATE judge_jobs SET status='queued', started_at=NULL, worker_token=NULL WHERE status='running'`)
	return err
}

func GetRegistrationEnabled(ctx context.Context, db *sql.DB) (bool, error) {
	var value string
	err := db.QueryRowContext(ctx, `SELECT value FROM system_settings WHERE key='registration_enabled'`).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return value == "1", nil
}

func SetRegistrationEnabled(ctx context.Context, db *sql.DB, enabled bool) error {
	_, err := db.ExecContext(ctx, `INSERT INTO system_settings(key, value) VALUES('registration_enabled', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, boolToSetting(enabled))
	return err
}

func boolToSetting(enabled bool) string {
	if enabled {
		return "1"
	}
	return "0"
}

func LogAdminPassword(generated string) {
	if generated == "" {
		return
	}
	log.Printf("[BOOTSTRAP] admin user created. username=admin password=%s", generated)
	log.Println("[BOOTSTRAP] This password is shown only once. Change it immediately after login.")
}

func NowUTC() time.Time {
	return time.Now().UTC()
}

