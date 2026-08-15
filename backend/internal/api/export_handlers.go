package api

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// 匹配 /api/uploads/<filename>.<ext> 形式的图片引用。
// 文件名可能为：随机十六进制（如 a1b2...c5d6.png）、UUID（含连字符，如 xxxx-xxxx-....png）、
// 旧版序号（如 img_0001.png），故用 [a-zA-Z0-9_-]+ 而非仅 [a-f0-9]+，
// 否则这些非纯十六进制文件名会在导出时被漏掉、图片无法打进 zip。
var imageRefPattern = regexp.MustCompile(`/api/uploads/([a-zA-Z0-9_-]+\.(png|jpe?g|gif|webp|svg))`)

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
		fields := []string{p.StatementMD, string(p.BodyJSON), string(p.AnswerJSON), string(p.Solutions)}
		for _, m := range imageRefPattern.FindAllStringSubmatch(strings.Join(fields, "\n"), -1) {
			if !seen[m[1]] {
				seen[m[1]] = true
				refs = append(refs, m[1])
			}
		}
	}
	return refs
}

var imagesPathPattern = regexp.MustCompile(`\(images/`)

func rewriteProblemImageRefs(p *problemPayload) {
	p.StatementMD = imagesPathPattern.ReplaceAllString(p.StatementMD, "(/api/uploads/")
	if len(p.BodyJSON) > 0 {
		p.BodyJSON = json.RawMessage(imagesPathPattern.ReplaceAllString(string(p.BodyJSON), "(/api/uploads/"))
	}
	if len(p.AnswerJSON) > 0 {
		p.AnswerJSON = json.RawMessage(imagesPathPattern.ReplaceAllString(string(p.AnswerJSON), "(/api/uploads/"))
	}
	if len(p.Solutions) > 0 {
		p.Solutions = json.RawMessage(imagesPathPattern.ReplaceAllString(string(p.Solutions), "(/api/uploads/"))
	}
}

type problemExportEntry struct {
	Type           string          `json:"type"`
	Title          string          `json:"title"`
	Tags           []string        `json:"tags"`
	StatementMD    string          `json:"statementMd"`
	BodyJSON       json.RawMessage `json:"bodyJson"`
	AnswerJSON     json.RawMessage `json:"answerJson"`
	Solutions      json.RawMessage `json:"solutions,omitempty"`
	TimeLimitMS    int             `json:"timeLimitMs,omitempty"`
	MemoryLimitMiB int             `json:"memoryLimitMiB,omitempty"`
}


func marshalNoEscape(v interface{}) ([]byte, error) {
	buf := new(bytes.Buffer)
	enc := json.NewEncoder(buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func buildProblemsZip(problems []problemExportEntry) ([]byte, error) {
	return buildTrainingPlanZip(problems, nil, "", "", nil)
}

type trainingPlanChapterJSON struct {
	Title      string  `json:"title"`
	OrderNo    int     `json:"orderNo"`
	ProblemIDs []int   `json:"problemIds"`
}

type practiceExportJSON struct {
	Title       string   `json:"title"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags"`
}

func buildTrainingPlanZip(problems []problemExportEntry, chapters []trainingPlanChapterJSON, planTitle string, planDesc string, planTags []string) ([]byte, error) {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	problemsJSON, err := marshalNoEscape(problems)
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

	// Only write trainingPlan.json for training/practice export (has chapters or metadata).
	// Pure problem export (buildProblemsZip) should not include it.
	if len(chapters) > 0 || planTitle != "" || len(planTags) > 0 {
		planData := map[string]interface{}{"chapters": chapters}
		if planTitle != "" {
			planData["title"] = planTitle
		}
		if len(planTags) > 0 {
			planData["tags"] = planTags
		}
		planJSON, err := marshalNoEscape(planData)
		if err != nil {
			return nil, err
		}
		tf, err := w.Create("trainingPlan.json")
		if err != nil {
			return nil, err
		}
		if _, err := tf.Write(planJSON); err != nil {
			return nil, err
		}
	}

	imageFiles := collectProblemImageRefs(problems)
	for _, filename := range imageFiles {
		imgPath := filepath.Join(uploadDir, filename)
		data, err := os.ReadFile(imgPath)
		if err != nil {
			continue
		}
		ff, err := w.Create("images/" + filename)
		if err != nil {
			return nil, err
		}
		if _, err := ff.Write(data); err != nil {
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
	var problemIDs []int64
	idsParam := c.Query("ids")
	if strings.TrimSpace(idsParam) != "" {
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
	} else {
		// 未传 ids 时按列表过滤条件导出（dirId / tags / q），无过滤条件则导出空间全部题目。
		filter := parseProblemListFilter(c)
		where, whereArgs := buildProblemFilterSQL(spaceID, filter)
		rows, err := a.DB.Query(`SELECT p.id FROM space_problems p WHERE `+where+` ORDER BY p.id DESC`, whereArgs...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				return err
			}
			problemIDs = append(problemIDs, id)
		}
		if err := rows.Err(); err != nil {
			return err
		}
		if len(problemIDs) == 0 {
			return respondError(c, fiber.StatusBadRequest, "no problems match the filter")
		}
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
	// Try to get a meaningful name from query param, fall back to space ID
	exportName := c.Query("name", "")
	filename := fmt.Sprintf("problems_%d.zip", spaceID)
	if exportName != "" {
		filename = exportName + ".zip"
	}
	c.Set("Content-Type", "application/zip")
	c.Set("Content-Disposition", contentDisposition(filename))
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
		// 兼容旧版 ZIP：图片不一定放在根目录 images/ 下，可能位于任意目录层级
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

// parseProblemsJSON 解析 ZIP 中的题目数据。
// 兼容旧版 ZIP 结构：文件可位于任意目录、可用 problem.json 等别名或任意 *.json，
// 内容可以是数组 / {problems|data:[...]} 包装 / 单个题目对象，并自动映射旧版字段名。
func parseProblemsJSON(zipData []byte) ([]problemPayload, error) {
	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("invalid zip file: %w", err)
	}
	raw, name, err := findProblemsJSON(reader)
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return nil, fmt.Errorf("problems.json not found in zip")
	}
	items, err := unwrapProblemArray(raw)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", name, err)
	}
	problems := make([]problemPayload, 0, len(items))
	for _, item := range items {
		p, err := decodeLegacyProblem(item)
		if err != nil {
			return nil, fmt.Errorf("parse %s: %w", name, err)
		}
		problems = append(problems, *p)
	}
	return problems, nil
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
		rewriteProblemImageRefs(p)
		problemID, err := insertSpaceProblem(a.DB, spaceID, user.ID, *p)
		if err != nil {
			return err
		}
		created = append(created, fiber.Map{"id": problemID, "title": p.Title})
	}
	return respondData(c, fiber.Map{"problems": created})
}

type importedTrainingPlanMeta struct {
	Title       string                    `json:"title"`
	Description string                    `json:"description"`
	Tags        []string                  `json:"tags"`
	Chapters    []trainingPlanChapterJSON `json:"chapters"`
}

func parseTrainingPlanJSON(zipData []byte) (*importedTrainingPlanMeta, error) {
	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("invalid zip file: %w", err)
	}
	// 兼容旧版 ZIP：trainingPlan.json 可位于任意目录层级
	data, name, err := findZipFileByNames(reader, "trainingPlan.json")
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, nil // no trainingPlan.json is OK
	}
	var meta importedTrainingPlanMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, fmt.Errorf("parse %s: %w", name, err)
	}
	return &meta, nil
}

func (a *API) handleImportTrainingPlan(c *fiber.Ctx) error {
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

	// Step 1: Extract images
	if _, err := extractZipImages(zipData); err != nil {
		return respondError(c, fiber.StatusBadRequest, err.Error())
	}

	// Step 2: Import problems
	problems, err := parseProblemsJSON(zipData)
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, err.Error())
	}
	createdIDs := make([]int64, 0, len(problems))
	for i := range problems {
		p := &problems[i]
		if err := normalizeProblemPayload(p); err != nil {
			return respondError(c, fiber.StatusBadRequest, fmt.Sprintf("题目 %q: %v", p.Title, err))
		}
		rewriteProblemImageRefs(p)
		problemID, err := insertSpaceProblem(a.DB, spaceID, user.ID, *p)
		if err != nil {
			return err
		}
		createdIDs = append(createdIDs, problemID)
	}

	// Step 3: Parse training plan structure
	planMeta, err := parseTrainingPlanJSON(zipData)
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, err.Error())
	}
	if planMeta == nil || len(planMeta.Chapters) == 0 {
		// No trainingPlan.json or no chapters — just return imported problems
		return respondData(c, fiber.Map{"problems": createdIDs, "chapters": nil})
	}

	// Step 4: Map index-based problemIds to new DB IDs
	type chapterBody struct {
		Title      string  `json:"title"`
		OrderNo    int     `json:"orderNo"`
		ProblemIDs []int64 `json:"problemIds"`
	}
	mappedChapters := make([]chapterBody, 0, len(planMeta.Chapters))
	for _, ch := range planMeta.Chapters {
		cb := chapterBody{Title: ch.Title, OrderNo: ch.OrderNo, ProblemIDs: make([]int64, 0, len(ch.ProblemIDs))}
		for _, idx := range ch.ProblemIDs {
			if idx >= 0 && idx < len(createdIDs) {
				cb.ProblemIDs = append(cb.ProblemIDs, createdIDs[idx])
			}
		}
		mappedChapters = append(mappedChapters, cb)
	}

	return respondData(c, fiber.Map{
		"problems":    createdIDs,
		"chapters":    mappedChapters,
		"tags":        planMeta.Tags,
		"title":       planMeta.Title,
		"description": planMeta.Description,
	})
	}


func (a *API) handleExportPractice(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	practiceID, err := parseIDParam(c, "practiceId")
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

	// Read practice metadata
	var hwTitle, hwDesc string
	var hwTagsJSON sql.NullString
	if err := a.DB.QueryRow(`SELECT title, description, tags_json FROM practices WHERE id=? AND space_id=?`, practiceID, spaceID).Scan(&hwTitle, &hwDesc, &hwTagsJSON); err != nil {
		return err
	}
	hwTags := decodeProblemTags(scanNullString(hwTagsJSON))

	items, err := a.loadPracticeItems(practiceID)
	if err != nil {
		return err
	}
	var problems []problemExportEntry
	for _, item := range items {
		problemID := int64FromAny(item["problemId"])
		entry, err := a.loadProblemForExport(spaceID, problemID)
		if err != nil {
			return err
		}
		problems = append(problems, *entry)
	}

	// Build the ZIP
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	problemsJSON, err := marshalNoEscape(problems)
	if err != nil {
		return err
	}
	pf, err := w.Create("problems.json")
	if err != nil {
		return err
	}
	if _, err := pf.Write(problemsJSON); err != nil {
		return err
	}

	hwExport := practiceExportJSON{Title: hwTitle, Description: hwDesc, Tags: hwTags}
	hwJSON, err := marshalNoEscape(hwExport)
	if err != nil {
		return err
	}
	hf, err := w.Create("practice.json")
	if err != nil {
		return err
	}
	if _, err := hf.Write(hwJSON); err != nil {
		return err
	}

	imageFiles := collectProblemImageRefs(problems)
	for _, filename := range imageFiles {
		imgPath := filepath.Join(uploadDir, filename)
		data, err := os.ReadFile(imgPath)
		if err != nil {
			continue
		}
		ff, err := w.Create("images/" + filename)
		if err != nil {
			return err
		}
		if _, err := ff.Write(data); err != nil {
			return err
		}
	}
	if err := w.Close(); err != nil {
		return err
	}

	c.Set("Content-Type", "application/zip")
	c.Set("Content-Disposition", contentDisposition(hwTitle+".zip"))
	return c.Send(buf.Bytes())
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

	// Read plan title and tags
	var planTitle, planDesc string
	var planTagsJSON sql.NullString
	if err := a.DB.QueryRow(`SELECT title, description, tags_json FROM training_plans WHERE id=? AND space_id=?`, planID, spaceID).Scan(&planTitle, &planDesc, &planTagsJSON); err != nil {
		return err
	}
	planTags := decodeProblemTags(scanNullString(planTagsJSON))

	// Single query: join chapters, items, and problem details together
	rows, err := a.DB.Query(`
	SELECT tc.id, tc.title, tc.order_no,
	       ti.problem_id,
	       sp.type, sp.title, sp.tags_json, sp.statement_md,
	       sp.body_json, sp.answer_json, sp.solutions_json, sp.time_limit_ms, sp.memory_limit_mib
	FROM training_chapters tc
	LEFT JOIN training_items ti ON ti.chapter_id = tc.id
	LEFT JOIN space_problems sp ON sp.id = ti.problem_id AND sp.space_id = ?
	WHERE tc.plan_id = ?
	ORDER BY tc.order_no, ti.order_no`, spaceID, planID)
	if err != nil {
		return err
	}
	defer rows.Close()

	type chapterInfo struct {
		Title      string  `json:"title"`
		OrderNo    int     `json:"orderNo"`
		ProblemIDs []int     `json:"problemIds"`
	}
	chapterMap := make(map[int64]*chapterInfo)
	chapterOrder := make([]int64, 0)
	seen := make(map[int64]bool)
	problems := make([]problemExportEntry, 0)

	for rows.Next() {
		var chID int64
		var chTitle string
		var chOrderNo int
		var problemID sql.NullInt64
		var pType, pTitle, pTags, pStmt, pBody, pAnswer, pSolutions sql.NullString
		var pTime, pMem sql.NullInt64

		if err := rows.Scan(&chID, &chTitle, &chOrderNo,
			&problemID,
			&pType, &pTitle, &pTags, &pStmt,
			&pBody, &pAnswer, &pSolutions, &pTime, &pMem); err != nil {
			return err
		}

		ch, ok := chapterMap[chID]
		if !ok {
			ch = &chapterInfo{Title: chTitle, OrderNo: chOrderNo, ProblemIDs: make([]int, 0)}
			chapterMap[chID] = ch
			chapterOrder = append(chapterOrder, chID)
		}

		if problemID.Valid && pType.Valid {
			pid := problemID.Int64
			if !seen[pid] {
				seen[pid] = true
				ch.ProblemIDs = append(ch.ProblemIDs, len(problems))
				entry := problemExportEntry{
					Type:        pType.String,
					Title:       pTitle.String,
					Tags:        decodeProblemTags(pTags.String),
					StatementMD: pStmt.String,
					BodyJSON:    json.RawMessage(pBody.String),
					AnswerJSON:  json.RawMessage(pAnswer.String),
					Solutions:   decodeProblemSolutions(pSolutions.String),
				}
				if pType.String == "programming" {
					entry.TimeLimitMS = int(pTime.Int64)
					entry.MemoryLimitMiB = int(pMem.Int64)
				}
				problems = append(problems, entry)
			}
		}
	}

	// Build chapters slice in order
	planChapters := make([]trainingPlanChapterJSON, 0, len(chapterOrder))
	for _, chID := range chapterOrder {
		ch := chapterMap[chID]
		planChapters = append(planChapters, trainingPlanChapterJSON{
			Title: ch.Title, OrderNo: ch.OrderNo, ProblemIDs: ch.ProblemIDs,
		})
	}

	zipBytes, err := buildTrainingPlanZip(problems, planChapters, planTitle, planDesc, planTags)
	if err != nil {
		return err
	}
	c.Set("Content-Type", "application/zip")
	c.Set("Content-Disposition", contentDisposition(planTitle+".zip"))
	return c.Send(zipBytes)
}

func (a *API) loadProblemForExport(spaceID, problemID int64) (*problemExportEntry, error) {
	var typeStr, title, tagsJSON, statement, bodyJSON, answerJSON, solutionsJSON string
	var timeLimit, memoryLimit int64
	err := a.DB.QueryRow(`
SELECT type, title, tags_json, statement_md, body_json, answer_json, solutions_json, time_limit_ms, memory_limit_mib
FROM space_problems WHERE id=? AND space_id=?`, problemID, spaceID).Scan(
		&typeStr, &title, &tagsJSON, &statement, &bodyJSON, &answerJSON, &solutionsJSON, &timeLimit, &memoryLimit)
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
		Solutions:   decodeProblemSolutions(solutionsJSON),
	}
	if typeStr == "programming" {
		entry.TimeLimitMS = int(timeLimit)
		entry.MemoryLimitMiB = int(memoryLimit)
	}
	return entry, nil
}

// sanitizeFilename 生成 ASCII-only 文件名（用于 Content-Disposition filename=），
// 非 ASCII 字符（中文等）替换为 _，依赖 filename* 传递原始名称
func sanitizeFilename(name string) string {
	// 移除非 ASCII 和控制字符（\x00-\x1F, \x7F 以上）
	re := regexp.MustCompile(`[^\x20-\x7E]`)
	name = re.ReplaceAllString(name, "_")
	// 移除 Windows 文件名非法字符
	re2 := regexp.MustCompile(`[\\/:*?"<>|]`)
	name = re2.ReplaceAllString(name, "_")
	// 折叠连续下划线
	re3 := regexp.MustCompile(`_+`)
	name = re3.ReplaceAllString(name, "_")
	name = strings.Trim(name, "_.")
	if len(name) > 100 {
		name = name[:100]
	}
	if name == "" {
		name = "export"
	}
	return name
}

// contentDisposition 返回同时包含 ASCII 回退和 UTF-8 文件名的 Content-Disposition 值
// 格式: attachment; filename="ascii.zip"; filename*=UTF-8''percent-encoded-name.zip
func contentDisposition(filename string) string {
	safeName := sanitizeFilename(filename)
	utf8Name := url.PathEscape(filename)
	return fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`, safeName, utf8Name)
}

func parseIntParam(s string) (int64, error) {
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid id: %s", s)
	}
	return id, nil
}



