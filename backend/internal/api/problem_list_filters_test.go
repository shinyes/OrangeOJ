package api

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"testing"
)

// insertTestProblem 直接在测试库插入一道带目录/标签的题目。
func insertTestProblem(t *testing.T, database *sql.DB, spaceID int64, title string, tags []string, dirID *int64) int64 {
	t.Helper()
	tagsJSON := "[]"
	if len(tags) > 0 {
		payload, _ := json.Marshal(tags)
		tagsJSON = string(payload)
	}
	res, err := database.Exec(`
INSERT INTO space_problems(space_id, type, title, tags_json, statement_md, body_json, answer_json, directory_id, created_by)
VALUES(?, 'programming', ?, ?, 'statement', '{}', '{}', ?, 1)`, spaceID, title, tagsJSON, dirID)
	if err != nil {
		t.Fatalf("insert problem: %v", err)
	}
	id, _ := res.LastInsertId()
	return id
}

func insertTestDirectory(t *testing.T, database *sql.DB, spaceID int64, name string) int64 {
	t.Helper()
	res, err := database.Exec(`INSERT INTO problem_directories(space_id, name) VALUES(?, ?)`, spaceID, name)
	if err != nil {
		t.Fatalf("insert directory: %v", err)
	}
	id, _ := res.LastInsertId()
	return id
}

func TestListSpaceProblemsServerSideFilters(t *testing.T) {
	app, database := newTestApp(t, false)

	memberID := seedUser(t, database, "list_filter_member", "listfiltermember123")
	spaceID := mustCreateSpace(t, database, "Space-List-Filters")
	mustAddMember(t, database, spaceID, memberID, "member")

	dirA := insertTestDirectory(t, database, spaceID, "目录A")
	dirB := insertTestDirectory(t, database, spaceID, "目录B")
	insertTestProblem(t, database, spaceID, "入门题一", []string{"入门"}, &dirA)
	insertTestProblem(t, database, spaceID, "模拟题二", []string{"模拟"}, &dirB)
	insertTestProblem(t, database, spaceID, "入门模拟三", []string{"入门", "模拟"}, nil)
	insertTestProblem(t, database, spaceID, "进阶题四", []string{"进阶"}, nil)

	cookie := mustLogin(t, app, "list_filter_member", "listfiltermember123")
	base := "/api/spaces/" + strconv.FormatInt(spaceID, 10) + "/problems"

	get := func(query string) ([]map[string]interface{}, int64) {
		t.Helper()
		resp := doJSONRequest(t, app, http.MethodGet, base+query, cookie, nil)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for %s, got %d", query, resp.StatusCode)
		}
		env := decodeEnvelope[map[string]interface{}](t, resp)
		items, _ := env.Data["items"].([]interface{})
		total := int64(env.Data["total"].(float64))
		result := make([]map[string]interface{}, 0, len(items))
		for _, item := range items {
			result = append(result, item.(map[string]interface{}))
		}
		return result, total
	}

	// 未分类
	items, total := get("?limit=50&dirId=-1")
	if total != 2 || len(items) != 2 {
		t.Fatalf("expected 2 uncategorized problems, got total=%d items=%d", total, len(items))
	}
	// 指定目录
	items, total = get("?limit=50&dirId=" + strconv.FormatInt(dirA, 10))
	if total != 1 || items[0]["title"] != "入门题一" {
		t.Fatalf("expected 1 problem in dirA, got total=%d %+v", total, items)
	}
	// 单标签精确匹配（"入门"不应误匹配其他）
	_, total = get("?limit=50&tags=入门")
	if total != 2 {
		t.Fatalf("expected 2 problems tagged 入门, got %d", total)
	}
	// 多标签 AND
	_, total = get("?limit=50&tags=入门,模拟")
	if total != 1 {
		t.Fatalf("expected 1 problem tagged 入门+模拟, got %d", total)
	}
	// 关键词搜索（标题）
	_, total = get("?limit=50&q=模拟")
	if total != 2 {
		t.Fatalf("expected 2 problems matching 模拟, got %d", total)
	}
	// 关键词搜索（ID 数字）
	id := insertTestProblem(t, database, spaceID, "数字题", nil, nil)
	_, total = get("?limit=50&q=" + strconv.FormatInt(id, 10))
	if total != 1 {
		t.Fatalf("expected 1 problem matching id %d, got %d", id, total)
	}
	// 组合过滤：目录 + 标签
	_, total = get("?limit=50&dirId=" + strconv.FormatInt(dirA, 10) + "&tags=入门")
	if total != 1 {
		t.Fatalf("expected 1 problem in dirA tagged 入门, got %d", total)
	}
	// 分页
	items, total = get("?limit=2&offset=0")
	if total != 5 || len(items) != 2 {
		t.Fatalf("expected total=5 page=2 items, got total=%d items=%d", total, len(items))
	}
	// 列表项不应包含 statementMd（减轻大题库传输负担）
	if _, ok := items[0]["statementMd"]; ok {
		t.Fatalf("list items must not contain statementMd: %+v", items[0])
	}
}

func TestProblemDirectoryCountsAndTags(t *testing.T) {
	app, database := newTestApp(t, false)

	memberID := seedUser(t, database, "meta_member", "metamember123")
	spaceID := mustCreateSpace(t, database, "Space-Meta")
	mustAddMember(t, database, spaceID, memberID, "member")

	dirA := insertTestDirectory(t, database, spaceID, "目录A")
	dirB := insertTestDirectory(t, database, spaceID, "目录B")
	insertTestProblem(t, database, spaceID, "甲", []string{"入门"}, &dirA)
	insertTestProblem(t, database, spaceID, "乙", []string{"入门"}, &dirA)
	insertTestProblem(t, database, spaceID, "丙", []string{"模拟"}, &dirB)
	insertTestProblem(t, database, spaceID, "丁", []string{"入门", "进阶"}, nil)

	cookie := mustLogin(t, app, "meta_member", "metamember123")

	// counts
	resp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problem-directories/counts", cookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected counts 200, got %d", resp.StatusCode)
	}
	countsEnv := decodeEnvelope[map[string]interface{}](t, resp)
	counts, _ := countsEnv.Data["counts"].(map[string]interface{})
	if counts[strconv.FormatInt(dirA, 10)] != float64(2) || counts[strconv.FormatInt(dirB, 10)] != float64(1) {
		t.Fatalf("unexpected directory counts: %+v", counts)
	}
	if countsEnv.Data["uncategorized"] != float64(1) {
		t.Fatalf("unexpected uncategorized count: %+v", countsEnv.Data)
	}

	// tags
	tagsResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/tags", cookie, nil)
	if tagsResp.StatusCode != http.StatusOK {
		t.Fatalf("expected tags 200, got %d", tagsResp.StatusCode)
	}
	tagsEnv := decodeEnvelope[[]map[string]interface{}](t, tagsResp)
	if len(tagsEnv.Data) != 3 {
		t.Fatalf("expected 3 tags, got %+v", tagsEnv.Data)
	}
	if tagsEnv.Data[0]["tag"] != "入门" || tagsEnv.Data[0]["count"] != float64(3) {
		t.Fatalf("expected 入门(3) first, got %+v", tagsEnv.Data[0])
	}
}

func TestExportProblemsByFilters(t *testing.T) {
	app, database := newTestApp(t, false)

	adminID := seedUser(t, database, "export_filter_admin", "exportfilteradmin123")
	spaceID := mustCreateSpace(t, database, "Space-Export-Filters")
	mustAddMember(t, database, spaceID, adminID, "space_admin")

	insertTestProblem(t, database, spaceID, "过滤导出-入门", []string{"入门"}, nil)
	insertTestProblem(t, database, spaceID, "过滤导出-模拟", []string{"模拟"}, nil)
	insertTestProblem(t, database, spaceID, "过滤导出-入门二", []string{"入门"}, nil)

	cookie := mustLogin(t, app, "export_filter_admin", "exportfilteradmin123")

	readZipTitles := func(resp *http.Response) []string {
		t.Helper()
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected export 200, got %d", resp.StatusCode)
		}
		body := new(bytes.Buffer)
		_, _ = body.ReadFrom(resp.Body)
		reader, err := zip.NewReader(bytes.NewReader(body.Bytes()), int64(body.Len()))
		if err != nil {
			t.Fatalf("open zip: %v", err)
		}
		for _, f := range reader.File {
			if f.Name != "problems.json" {
				continue
			}
			rc, _ := f.Open()
			var problems []map[string]interface{}
			if err := json.NewDecoder(rc).Decode(&problems); err != nil {
				t.Fatalf("decode problems.json: %v", err)
			}
			rc.Close()
			titles := make([]string, 0, len(problems))
			for _, p := range problems {
				titles = append(titles, fmt.Sprintf("%v", p["title"]))
			}
			return titles
		}
		t.Fatal("problems.json not found in export zip")
		return nil
	}

	// 按标签导出列表
	resp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/export?tags=入门&name=filtered", cookie, nil)
	titles := readZipTitles(resp)
	if len(titles) != 2 {
		t.Fatalf("expected 2 exported problems, got %+v", titles)
	}
	for _, title := range titles {
		if title != "过滤导出-入门" && title != "过滤导出-入门二" {
			t.Fatalf("unexpected exported title: %s", title)
		}
	}

	// 无过滤条件导出全部
	resp = doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/export?name=all", cookie, nil)
	titles = readZipTitles(resp)
	if len(titles) != 3 {
		t.Fatalf("expected 3 exported problems, got %+v", titles)
	}

	// 无匹配时返回 400
	resp = doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/export?tags=不存在的标签", cookie, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for no match, got %d", resp.StatusCode)
	}

	// 仍支持 ids 方式导出
	resp = doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/problems/export?ids="+strconv.FormatInt(insertTestProblem(t, database, spaceID, "按ID导出", nil, nil), 10), cookie, nil)
	titles = readZipTitles(resp)
	if len(titles) != 1 || titles[0] != "按ID导出" {
		t.Fatalf("unexpected ids export result: %+v", titles)
	}
}
