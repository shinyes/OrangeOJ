package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	oauth "orangeoj/backend/internal/auth"
	"orangeoj/backend/internal/model"

	"github.com/gofiber/fiber/v2"
)

type objectiveSubmitRequest struct {
	Answer interface{} `json:"answer"`
}

type codeSubmitRequest struct {
	Language   string `json:"language"`
	SourceCode string `json:"sourceCode"`
	InputData  string `json:"inputData"`
}

func (a *API) handleObjectiveSubmit(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	problemID, err := parseIDParam(c, "problemId")
	if err != nil {
		return err
	}
	if err := a.ensureSpaceReadable(spaceID, user.ID, user.GlobalRole); err != nil {
		return err
	}
	if err := a.ensureProblemLinked(spaceID, problemID); err != nil {
		return err
	}

	var pType, answerJSON string
	if err := a.DB.QueryRow(`SELECT type, answer_json FROM root_problems WHERE id=?`, problemID).Scan(&pType, &answerJSON); err != nil {
		return err
	}
	if pType == string(model.ProblemTypeProgramming) {
		return respondError(c, fiber.StatusBadRequest, "use programming submit endpoints")
	}

	var req objectiveSubmitRequest
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	correct, err := evaluateObjectiveAnswer(pType, answerJSON, req.Answer)
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, err.Error())
	}
	verdict := model.VerdictWA
	score := 0
	if correct {
		verdict = model.VerdictAC
		score = 100
	}
	answerText := strings.TrimSpace(fmt.Sprintf("%v", req.Answer))

	res, err := a.DB.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict, score, stdout, stderr, finished_at)
VALUES(?, ?, ?, ?, '', '', ?, 'objective', 'done', ?, ?, '', '', CURRENT_TIMESTAMP)`, user.ID, spaceID, problemID, pType, answerText, string(verdict), score)
	if err != nil {
		return err
	}
	submissionID, _ := res.LastInsertId()

	_, _ = a.DB.Exec(`
INSERT INTO user_problem_progress(space_id, user_id, problem_id, best_verdict, best_score, last_submission_id, updated_at)
VALUES(?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(space_id, user_id, problem_id)
DO UPDATE SET
	best_verdict=CASE WHEN excluded.best_score >= user_problem_progress.best_score THEN excluded.best_verdict ELSE user_problem_progress.best_verdict END,
	best_score=CASE WHEN excluded.best_score >= user_problem_progress.best_score THEN excluded.best_score ELSE user_problem_progress.best_score END,
	last_submission_id=excluded.last_submission_id,
	updated_at=CURRENT_TIMESTAMP`, spaceID, user.ID, problemID, string(verdict), score, submissionID)

	return respondData(c, fiber.Map{"submissionId": submissionID, "verdict": verdict, "score": score})
}

func (a *API) handleRun(c *fiber.Ctx) error {
	return a.createProgrammingSubmission(c, model.SubmitTypeRun)
}

func (a *API) handleTest(c *fiber.Ctx) error {
	return a.createProgrammingSubmission(c, model.SubmitTypeTest)
}

func (a *API) handleSubmit(c *fiber.Ctx) error {
	return a.createProgrammingSubmission(c, model.SubmitTypeSubmit)
}

func (a *API) createProgrammingSubmission(c *fiber.Ctx, submitType model.SubmitType) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	problemID, err := parseIDParam(c, "problemId")
	if err != nil {
		return err
	}
	if err := a.ensureSpaceReadable(spaceID, user.ID, user.GlobalRole); err != nil {
		return err
	}
	if err := a.ensureProblemLinked(spaceID, problemID); err != nil {
		return err
	}
	var pType string
	if err := a.DB.QueryRow(`SELECT type FROM root_problems WHERE id=?`, problemID).Scan(&pType); err != nil {
		return err
	}
	if pType != string(model.ProblemTypeProgramming) {
		return respondError(c, fiber.StatusBadRequest, "this is not a programming problem")
	}

	var req codeSubmitRequest
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Language = strings.ToLower(strings.TrimSpace(req.Language))
	if req.Language == "" || strings.TrimSpace(req.SourceCode) == "" {
		return respondError(c, fiber.StatusBadRequest, "language and sourceCode are required")
	}
	if !isValidLanguage(req.Language) {
		return respondError(c, fiber.StatusBadRequest, "unsupported language")
	}

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
INSERT INTO submissions(user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'queued', 'PENDING')`, user.ID, spaceID, problemID, pType, req.Language, req.SourceCode, req.InputData, string(submitType))
	if err != nil {
		return err
	}
	submissionID, _ := res.LastInsertId()
	if _, err := tx.Exec(`
INSERT INTO judge_jobs(submission_id, status, priority, available_at)
VALUES(?, 'queued', 0, CURRENT_TIMESTAMP)`, submissionID); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"submissionId": submissionID, "status": "queued"})
}

func (a *API) handleListSubmissions(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	problemID, err := parseIDParam(c, "problemId")
	if err != nil {
		return err
	}
	if err := a.ensureSpaceReadable(spaceID, user.ID, user.GlobalRole); err != nil {
		return err
	}
	if err := a.ensureProblemLinked(spaceID, problemID); err != nil {
		return err
	}

	includeAll := false
	if parseBoolQueryParam(c, "all") {
		if user.GlobalRole == "system_admin" {
			includeAll = true
		} else {
			spaceAdmin, err := oauth.IsSpaceAdmin(a.DB, spaceID, user.ID)
			if err != nil {
				return err
			}
			includeAll = spaceAdmin
		}
	}

	log.Printf("[DEBUG] Fetching submissions for space=%d, problem=%d, user=%d, includeAll=%t", spaceID, problemID, user.ID, includeAll)

	query := `
SELECT s.id, s.user_id, u.username, s.space_id, s.problem_id, s.question_type, s.language, s.source_code, s.input_data, s.submit_type, s.status, s.verdict, s.time_ms, s.memory_kib, s.score, s.stdout, s.stderr, s.case_details_json, s.created_at, s.finished_at
FROM submissions s
JOIN users u ON u.id = s.user_id
WHERE s.space_id=? AND s.problem_id=?`
	args := []interface{}{spaceID, problemID}
	if !includeAll {
		query += ` AND s.user_id=?`
		args = append(args, user.ID)
	}
	query += `
ORDER BY s.id DESC
LIMIT 50`

	rows, err := a.DB.Query(query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	var submissions []map[string]interface{}
	for rows.Next() {
		var (
			id, userID, spID, problemID                                                 int64
			username, qType, language, sourceCode, inputData, submitType, status, verdict string
			timeMS, memoryKiB, score                                                    int
			stdout, stderr, caseDetailsJSON                                             string
			createdAt                                                                   string
			finishedAt                                                                  sql.NullString
		)
		if err := rows.Scan(&id, &userID, &username, &spID, &problemID, &qType, &language, &sourceCode, &inputData, &submitType, &status, &verdict, &timeMS, &memoryKiB, &score, &stdout, &stderr, &caseDetailsJSON, &createdAt, &finishedAt); err != nil {
			return err
		}
		submissions = append(submissions, fiber.Map{
			"id":           id,
			"userId":       userID,
			"username":     username,
			"spaceId":      spID,
			"problemId":    problemID,
			"questionType": qType,
			"language":     language,
			"sourceCode":   sourceCode,
			"inputData":    inputData,
			"submitType":   submitType,
			"status":       status,
			"verdict":      verdict,
			"timeMs":       timeMS,
			"memoryKiB":    memoryKiB,
			"score":        score,
			"stdout":       stdout,
			"stderr":       stderr,
			"caseDetails":  parseCaseDetailsJSON(caseDetailsJSON),
			"createdAt":    createdAt,
			"finishedAt":   scanNullString(finishedAt),
		})
	}

	return respondData(c, fiber.Map{"submissions": submissions})
}

func parseBoolQueryParam(c *fiber.Ctx, name string) bool {
	value := strings.TrimSpace(strings.ToLower(c.Query(name)))
	return value == "1" || value == "true" || value == "yes"
}

func (a *API) handleGetSubmission(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	submissionID, err := parseIDParam(c, "submissionId")
	if err != nil {
		return err
	}

	row := a.DB.QueryRow(`
SELECT id, user_id, space_id, problem_id, question_type, language, source_code, input_data, submit_type, status, verdict, time_ms, memory_kib, score, stdout, stderr, case_details_json, created_at, finished_at
FROM submissions
WHERE id=?`, submissionID)
	var (
		id, userID, spaceID, problemID                                      int64
		qType, language, sourceCode, inputData, submitType, status, verdict string
		timeMS, memoryKiB, score                                            int
		stdout, stderr, caseDetailsJSON                                     string
		createdAt                                                           string
		finishedAt                                                          sql.NullString
	)
	if err := row.Scan(&id, &userID, &spaceID, &problemID, &qType, &language, &sourceCode, &inputData, &submitType, &status, &verdict, &timeMS, &memoryKiB, &score, &stdout, &stderr, &caseDetailsJSON, &createdAt, &finishedAt); err != nil {
		return err
	}
	if user.GlobalRole != "system_admin" && user.ID != userID {
		spaceAdmin, err := oauth.IsSpaceAdmin(a.DB, spaceID, user.ID)
		if err != nil {
			return err
		}
		if !spaceAdmin {
			return respondError(c, fiber.StatusForbidden, "forbidden")
		}
	}
	return respondData(c, fiber.Map{
		"id":           id,
		"userId":       userID,
		"spaceId":      spaceID,
		"problemId":    problemID,
		"questionType": qType,
		"language":     language,
		"sourceCode":   sourceCode,
		"inputData":    inputData,
		"submitType":   submitType,
		"status":       status,
		"verdict":      verdict,
		"timeMs":       timeMS,
		"memoryKiB":    memoryKiB,
		"score":        score,
		"stdout":       stdout,
		"stderr":       stderr,
		"caseDetails":  parseCaseDetailsJSON(caseDetailsJSON),
		"createdAt":    createdAt,
		"finishedAt":   scanNullString(finishedAt),
	})
}

func parseCaseDetailsJSON(raw string) []fiber.Map {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []fiber.Map{}
	}

	var items []map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return []fiber.Map{}
	}

	result := make([]fiber.Map, 0, len(items))
	for _, item := range items {
		result = append(result, fiber.Map(item))
	}
	return result
}

func (a *API) handleSubmissionStream(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return err
	}
	submissionID, err := parseIDParam(c, "submissionId")
	if err != nil {
		return err
	}
	status, payload, err := a.streamSnapshot(submissionID, user.ID, user.GlobalRole)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"data":        json.RawMessage(payload),
		"isFinal":     status == "done" || status == "failed",
		"pollAfterMs": 1000,
	})
}

func (a *API) streamSnapshot(submissionID, requesterID int64, requesterRole string) (status string, payload string, err error) {
	row := a.DB.QueryRow(`SELECT user_id, space_id, status, verdict, score, stdout, stderr, time_ms, memory_kib FROM submissions WHERE id=?`, submissionID)
	var userID, spaceID int64
	var verdict, stdout, stderr string
	var score, timeMS, memoryKiB int
	if err = row.Scan(&userID, &spaceID, &status, &verdict, &score, &stdout, &stderr, &timeMS, &memoryKiB); err != nil {
		return
	}
	if requesterRole != "system_admin" && requesterID != userID {
		spaceAdmin, adminErr := oauth.IsSpaceAdmin(a.DB, spaceID, requesterID)
		err = adminErr
		if err != nil {
			return
		}
		if !spaceAdmin {
			err = fmt.Errorf("forbidden")
			return
		}
	}
	payload = mustJSON(fiber.Map{
		"submissionId": submissionID,
		"status":       status,
		"verdict":      verdict,
		"score":        score,
		"stdout":       stdout,
		"stderr":       stderr,
		"timeMs":       timeMS,
		"memoryKiB":    memoryKiB,
	})
	return
}

func mustJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return `{"error":"marshal"}`
	}
	return string(b)
}

func evaluateObjectiveAnswer(problemType string, answerJSON string, answer interface{}) (bool, error) {
	var target map[string]interface{}
	if err := json.Unmarshal([]byte(answerJSON), &target); err != nil {
		return false, fmt.Errorf("invalid answer_json")
	}
	expected, ok := target["answer"]
	if !ok {
		return false, fmt.Errorf("answer_json.answer required")
	}
	switch problemType {
	case string(model.ProblemTypeSingleChoice):
		exp := strings.TrimSpace(fmt.Sprintf("%v", expected))
		got := strings.TrimSpace(fmt.Sprintf("%v", answer))
		return strings.EqualFold(exp, got), nil
	case string(model.ProblemTypeTrueFalse):
		expBool, err := toBool(expected)
		if err != nil {
			return false, err
		}
		gotBool, err := toBool(answer)
		if err != nil {
			return false, err
		}
		return expBool == gotBool, nil
	default:
		return false, fmt.Errorf("unsupported objective type")
	}
}

func toBool(v interface{}) (bool, error) {
	s := strings.TrimSpace(strings.ToLower(fmt.Sprintf("%v", v)))
	switch s {
	case "true", "1", "t", "yes":
		return true, nil
	case "false", "0", "f", "no":
		return false, nil
	default:
		return false, fmt.Errorf("invalid bool value: %v", v)
	}
}

func (a *API) ensureProblemLinked(spaceID, problemID int64) error {
	var count int
	if err := a.DB.QueryRow(`SELECT COUNT(1) FROM space_problem_links WHERE space_id=? AND problem_id=?`, spaceID, problemID).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		return fiber.NewError(fiber.StatusNotFound, "problem not linked to space")
	}
	return nil
}

func (a *API) isSpaceMember(spaceID, userID int64) (bool, error) {
	var count int
	if err := a.DB.QueryRow(`SELECT COUNT(1) FROM space_members WHERE space_id=? AND user_id=?`, spaceID, userID).Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}
