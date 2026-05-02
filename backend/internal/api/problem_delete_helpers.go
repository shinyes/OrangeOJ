package api

import "database/sql"

func collectHomeworkProblemIDsTx(tx *sql.Tx, spaceID, homeworkID int64) ([]int64, error) {
	rows, err := tx.Query(`
SELECT DISTINCT hi.problem_id
FROM homework_items hi
JOIN homeworks h ON h.id = hi.homework_id
WHERE h.id=? AND h.space_id=?`, homeworkID, spaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ids, nil
}

func collectTrainingProblemIDsTx(tx *sql.Tx, spaceID, planID int64) ([]int64, error) {
	rows, err := tx.Query(`
SELECT DISTINCT ti.problem_id
FROM training_items ti
JOIN training_chapters tc ON tc.id = ti.chapter_id
JOIN training_plans tp ON tp.id = tc.plan_id
WHERE tp.id=? AND tp.space_id=?`, planID, spaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ids, nil
}

func deleteUnreferencedSpaceProblemsTx(tx *sql.Tx, spaceID int64, problemIDs []int64) (int, error) {
	problemIDs = uniquePositiveInt64s(problemIDs)
	deleted := 0
	for _, problemID := range problemIDs {
		var referenceCount int
		if err := tx.QueryRow(`
SELECT
  (
    SELECT COUNT(1)
    FROM homework_items hi
    JOIN homeworks h ON h.id = hi.homework_id
    WHERE hi.problem_id=? AND h.space_id=?
  ) + (
    SELECT COUNT(1)
    FROM training_items ti
    JOIN training_chapters tc ON tc.id = ti.chapter_id
    JOIN training_plans tp ON tp.id = tc.plan_id
    WHERE ti.problem_id=? AND tp.space_id=?
  )`, problemID, spaceID, problemID, spaceID).Scan(&referenceCount); err != nil {
			return deleted, err
		}
		if referenceCount > 0 {
			continue
		}

		if err := deleteProblemSubmissionRefsTx(tx, spaceID, problemID); err != nil {
			return deleted, err
		}
		res, err := tx.Exec(`DELETE FROM space_problems WHERE id=? AND space_id=?`, problemID, spaceID)
		if err != nil {
			return deleted, err
		}
		affected, err := res.RowsAffected()
		if err != nil {
			return deleted, err
		}
		if affected > 0 {
			deleted++
		}
	}
	return deleted, nil
}

func deleteProblemSubmissionRefsTx(tx *sql.Tx, spaceID, problemID int64) error {
	if _, err := tx.Exec(`
DELETE FROM homework_submission_record_items
WHERE problem_id=?
  AND submission_id IN (
    SELECT id
    FROM submissions
    WHERE space_id=? AND problem_id=?
  )`, problemID, spaceID, problemID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM user_problem_progress WHERE space_id=? AND problem_id=?`, spaceID, problemID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM submissions WHERE space_id=? AND problem_id=?`, spaceID, problemID); err != nil {
		return err
	}
	return nil
}

func deleteHomeworkOwnedRowsTx(tx *sql.Tx, homeworkID int64) error {
	if _, err := tx.Exec(`
DELETE FROM homework_submission_record_items
WHERE record_id IN (
  SELECT id
  FROM homework_submission_records
  WHERE homework_id=?
)`, homeworkID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM homework_submission_records WHERE homework_id=?`, homeworkID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM homework_targets WHERE homework_id=?`, homeworkID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM homework_items WHERE homework_id=?`, homeworkID); err != nil {
		return err
	}
	return nil
}

func deleteTrainingPlanOwnedRowsTx(tx *sql.Tx, planID int64) error {
	if _, err := tx.Exec(`
DELETE FROM training_items
WHERE chapter_id IN (
  SELECT id
  FROM training_chapters
  WHERE plan_id=?
)`, planID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM training_chapters WHERE plan_id=?`, planID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM training_participants WHERE plan_id=?`, planID); err != nil {
		return err
	}
	return nil
}

func uniquePositiveInt64s(items []int64) []int64 {
	if len(items) == 0 {
		return []int64{}
	}
	seen := make(map[int64]struct{}, len(items))
	result := make([]int64, 0, len(items))
	for _, item := range items {
		if item <= 0 {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result
}
