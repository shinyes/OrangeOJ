package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
)

var imageRefPattern = regexp.MustCompile(`/api/uploads/([a-f0-9]+\.(png|jpe?g|gif|webp|svg))`)

func collectImageRefs(markdownFields ...string) []string {
	seen := make(map[string]bool)
	var refs []string
	for _, field := range markdownFields {
		matches := imageRefPattern.FindAllStringSubmatch(field, -1)
		for _, m := range matches {
			filename := m[1]
			if !seen[filename] {
				seen[filename] = true
				refs = append(refs, filename)
			}
		}
	}
	return refs
}

func collectProblemImageRefs(problems []problemExportEntry) []string {
	seen := make(map[string]bool)
	var refs []string
	for _, p := range problems {
		fields := []string{p.StatementMD, string(p.BodyJSON), string(p.AnswerJSON)}
		for _, m := range imageRefPattern.FindAllStringSubmatch(strings.Join(fields, "\n"), -1) {
			if !seen[m[1]] {
				seen[m[1]] = true
				refs = append(refs, m[1])
			}
		}
	}
	return refs
}

type problemExportEntry struct {
	Type           string          `json:"type"`
	Title          string          `json:"title"`
	Tags           []string        `json:"tags"`
	StatementMD    string          `json:"statementMd"`
	BodyJSON       json.RawMessage `json:"bodyJson"`
	AnswerJSON     json.RawMessage `json:"answerJson"`
	TimeLimitMS    int             `json:"timeLimitMs,omitempty"`
	MemoryLimitMiB int             `json:"memoryLimitMiB,omitempty"`
}

func buildProblemsZip(problems []problemExportEntry) ([]byte, error) {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	problemsJSON, err := json.MarshalIndent(problems, "", "  ")
	if err != nil {
		return nil, err
	}
	f, err := w.Create("problems.json")
	if err != nil {
		return nil, err
	}
	if _, err := f.Write(problemsJSON); err != nil {
		return nil, err
	}

	imageFiles := collectProblemImageRefs(problems)
	for _, filename := range imageFiles {
		imgPath := filepath.Join(uploadDir, filename)
		data, err := os.ReadFile(imgPath)
		if err != nil {
			continue
		}
		f, err := w.Create("images/" + filename)
		if err != nil {
			return nil, err
		}
		if _, err := f.Write(data); err != nil {
			return nil, err
		}
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (a *API) handleExportProblems(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	user, err := getUser(c)
	if err != nil {
		return err
	}
	canManage, err := a.isSpaceAdmin(spaceID, user.ID, user.GlobalRole)
	if err != nil {
		return err
	}
	if !canManage {
		return respondError(c, fiber.StatusForbidden, "space admin required")
	}
	idsParam := c.Query("ids")
	if strings.TrimSpace(idsParam) == "" {
		return respondError(c, fiber.StatusBadRequest, "ids query parameter required")
	}
	var problemIDs []int64
	for _, part := range strings.Split(idsParam, ",") {
		id, err := parseIntParam(strings.TrimSpace(part))
		if err != nil {
			return respondError(c, fiber.StatusBadRequest, "invalid id in ids parameter: "+part)
		}
		problemIDs = append(problemIDs, id)
	}
	if len(problemIDs) == 0 {
		return respondError(c, fiber.StatusBadRequest, "at least one problem id required")
	}

	var problems []problemExportEntry
	for _, problemID := range problemIDs {
		if err := a.ensureProblemInSpace(spaceID, problemID); err != nil {
			return err
		}
		entry, err := a.loadProblemForExport(spaceID, problemID)
		if err != nil {
			return err
		}
		problems = append(problems, *entry)
	}

	zipBytes, err := buildProblemsZip(problems)
	if err != nil {
		return err
	}
	c.Set("Content-Type", "application/zip")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=problems_%d.zip", spaceID))
	return c.Send(zipBytes)
}

func extractZipImages(zipData []byte) (map[string]string, error) {
	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("invalid zip file: %w", err)
	}
	imageMap := make(map[string]string)
	for _, f := range reader.File {
		if f.FileInfo().IsDir() {
			continue
		}
		if !strings.HasPrefix(f.Name, "images/") {
			continue
		}
		filename := filepath.Base(f.Name)
		if !validImageExt(filepath.Ext(filename)) {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("read image %s from zip: %w", f.Name, err)
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}
		if len(data) > maxUploadSize {
			continue
		}
		dstPath := filepath.Join(uploadDir, filename)
		if err := os.WriteFile(dstPath, data, 0644); err != nil {
			return nil, fmt.Errorf("save image %s: %w", filename, err)
		}
		imageMap[filename] = "/api/uploads/" + filename
	}
	return imageMap, nil
}

func parseProblemsJSON(zipData []byte) ([]problemPayload, error) {
	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("invalid zip file: %w", err)
	}
	for _, f := range reader.File {
		if f.Name == "problems.json" {
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("read problems.json: %w", err)
			}
			defer rc.Close()
			var problems []problemPayload
			if err := json.NewDecoder(rc).Decode(&problems); err != nil {
				return nil, fmt.Errorf("parse problems.json: %w", err)
			}
			return problems, nil
		}
	}
	return nil, fmt.Errorf("problems.json not found in zip")
}

func (a *API) handleImportProblems(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	user, err := getUser(c)
	if err != nil {
		return err
	}
	canManage, err := a.isSpaceAdmin(spaceID, user.ID, user.GlobalRole)
	if err != nil {
		return err
	}
	if !canManage {
		return respondError(c, fiber.StatusForbidden, "space admin required")
	}
	file, err := c.FormFile("zip")
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, "missing zip file")
	}
	if file.Size > 100<<20 {
		return respondError(c, fiber.StatusBadRequest, "ZIP 文件不能超过 100MB")
	}
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	zipData, err := io.ReadAll(src)
	if err != nil {
		return err
	}
	if _, err := extractZipImages(zipData); err != nil {
		return respondError(c, fiber.StatusBadRequest, err.Error())
	}
	problems, err := parseProblemsJSON(zipData)
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, err.Error())
	}
	created := make([]fiber.Map, 0, len(problems))
	for i := range problems {
		p := &problems[i]
		if err := normalizeProblemPayload(p); err != nil {
			return respondError(c, fiber.StatusBadRequest, fmt.Sprintf("题目 %q: %v", p.Title, err))
		}
		problemID, err := insertSpaceProblem(a.DB, spaceID, user.ID, *p)
		if err != nil {
			return err
		}
		created = append(created, fiber.Map{"id": problemID, "title": p.Title})
	}
	return respondData(c, fiber.Map{"problems": created})
}

func (a *API) handleExportHomework(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	homeworkID, err := parseIDParam(c, "homeworkId")
	if err != nil {
		return err
	}
	user, err := getUser(c)
	if err != nil {
		return err
	}
	canManage, err := a.isSpaceAdmin(spaceID, user.ID, user.GlobalRole)
	if err != nil {
		return err
	}
	if !canManage {
		return respondError(c, fiber.StatusForbidden, "space admin required")
	}
	items, err := a.loadHomeworkItems(homeworkID)
	if err != nil {
		return err
	}
	var problems []problemExportEntry
	for _, item := range items {
		problemID := item["problemId"].(int64)
		entry, err := a.loadProblemForExport(spaceID, problemID)
		if err != nil {
			return err
		}
		problems = append(problems, *entry)
	}
	zipBytes, err := buildProblemsZip(problems)
	if err != nil {
		return err
	}
	c.Set("Content-Type", "application/zip")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=homework_%d.zip", homeworkID))
	return c.Send(zipBytes)
}

func (a *API) handleExportTrainingPlan(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	planID, err := parseIDParam(c, "planId")
	if err != nil {
		return err
	}
	user, err := getUser(c)
	if err != nil {
		return err
	}
	canManage, err := a.isSpaceAdmin(spaceID, user.ID, user.GlobalRole)
	if err != nil {
		return err
	}
	if !canManage {
		return respondError(c, fiber.StatusForbidden, "space admin required")
	}
	rows, err := a.DB.Query(`
SELECT ti.problem_id
FROM training_items ti
JOIN training_chapters tc ON tc.id = ti.chapter_id
WHERE tc.plan_id = ?
ORDER BY tc.order_no, ti.order_no`, planID)
	if err != nil {
		return err
	}
	defer rows.Close()
	seen := make(map[int64]bool)
	var problems []problemExportEntry
	for rows.Next() {
		var problemID int64
		if err := rows.Scan(&problemID); err != nil {
			return err
		}
		if seen[problemID] {
			continue
		}
		seen[problemID] = true
		entry, err := a.loadProblemForExport(spaceID, problemID)
		if err != nil {
			return err
		}
		problems = append(problems, *entry)
	}
	zipBytes, err := buildProblemsZip(problems)
	if err != nil {
		return err
	}
	c.Set("Content-Type", "application/zip")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=training_plan_%d.zip", planID))
	return c.Send(zipBytes)
}

func (a *API) loadProblemForExport(spaceID, problemID int64) (*problemExportEntry, error) {
	var typeStr, title, tagsJSON, statement, bodyJSON, answerJSON string
	var timeLimit, memoryLimit int64
	err := a.DB.QueryRow(`
SELECT type, title, tags_json, statement_md, body_json, answer_json, time_limit_ms, memory_limit_mib
FROM space_problems WHERE id=? AND space_id=?`, problemID, spaceID).Scan(
		&typeStr, &title, &tagsJSON, &statement, &bodyJSON, &answerJSON, &timeLimit, &memoryLimit)
	if err != nil {
		return nil, err
	}
	entry := &problemExportEntry{
		Type:        typeStr,
		Title:       title,
		Tags:        decodeProblemTags(tagsJSON),
		StatementMD: statement,
		BodyJSON:    json.RawMessage(bodyJSON),
		AnswerJSON:  json.RawMessage(answerJSON),
	}
	if typeStr == "programming" {
		entry.TimeLimitMS = int(timeLimit)
		entry.MemoryLimitMiB = int(memoryLimit)
	}
	return entry, nil
}

func parseIntParam(s string) (int64, error) {
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid id: %s", s)
	}
	return id, nil
}
