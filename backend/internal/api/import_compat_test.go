package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func buildTestZip(t *testing.T, entries map[string][]byte) []byte {
	t.Helper()
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)
	for name, data := range entries {
		f, err := w.Create(name)
		if err != nil {
			t.Fatalf("create zip entry %s: %v", name, err)
		}
		if _, err := f.Write(data); err != nil {
			t.Fatalf("write zip entry %s: %v", name, err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	return buf.Bytes()
}

func TestUnwrapProblemArray(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want int
	}{
		{"直接数组", `[{"type":"programming","title":"A"},{"type":"single_choice","title":"B"}]`, 2},
		{"problems 包装", `{"problems":[{"type":"programming","title":"A"}]}`, 1},
		{"data 包装", `{"data":[{"type":"programming","title":"A"}]}`, 1},
		{"单个题目对象", `{"type":"programming","title":"A"}`, 1},
		{"空数组", `[]`, 0},
		{"数组中含 null", `[null,{"type":"programming","title":"A"}]`, 1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			items, err := unwrapProblemArray([]byte(tc.raw))
			if err != nil {
				t.Fatalf("unwrap failed: %v", err)
			}
			if len(items) != tc.want {
				t.Fatalf("got %d items, want %d", len(items), tc.want)
			}
		})
	}

	bad := []string{`"just a string"`, `42`, `{"title":"没有 type 的对象"}`, `{"items":[]}`}
	for _, raw := range bad {
		if _, err := unwrapProblemArray([]byte(raw)); err == nil {
			t.Fatalf("expected error for %s", raw)
		}
	}
}

func TestDecodeLegacyProblem(t *testing.T) {
	raw := json.RawMessage(`{
		"type": "programming",
		"title": "旧格式题",
		"statement": "旧版题面",
		"timeLimit": 2000,
		"memoryLimit": 512,
		"bodyJson": {
			"input": "输入",
			"output": "输出",
			"examples": [{"input": "1", "output": "2"}],
			"testcases": [{"input": "3", "output": "4"}]
		},
		"answerJson": {}
	}`)
	p, err := decodeLegacyProblem(raw)
	if err != nil {
		t.Fatalf("decode legacy problem: %v", err)
	}
	if p.StatementMD != "旧版题面" {
		t.Fatalf("statement -> statementMd mapping failed: %q", p.StatementMD)
	}
	if p.TimeLimitMS != 2000 {
		t.Fatalf("timeLimit -> timeLimitMs mapping failed: %d", p.TimeLimitMS)
	}
	if p.MemoryLimitMiB != 512 {
		t.Fatalf("memoryLimit -> memoryLimitMiB mapping failed: %d", p.MemoryLimitMiB)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(p.BodyJSON, &body); err != nil {
		t.Fatalf("decode bodyJson: %v", err)
	}
	if body["inputFormat"] != "输入" || body["outputFormat"] != "输出" {
		t.Fatalf("input/output mapping failed: %+v", body)
	}
	if _, ok := body["examples"]; ok {
		t.Fatalf("examples should be moved to samples: %+v", body)
	}
	if _, ok := body["testcases"]; ok {
		t.Fatalf("testcases should be moved to testCases: %+v", body)
	}
	if samples, ok := body["samples"].([]interface{}); !ok || len(samples) != 1 {
		t.Fatalf("expected samples from examples: %+v", body["samples"])
	}
	if cases, ok := body["testCases"].([]interface{}); !ok || len(cases) != 1 {
		t.Fatalf("expected testCases from testcases: %+v", body["testCases"])
	}

	// 已有新字段时不应被旧字段覆盖
	rawNew := json.RawMessage(`{
		"type": "programming",
		"title": "新格式题",
		"statementMd": "新题面",
		"statement": "旧题面",
		"bodyJson": {"testCases": [{"input":"1","output":"2"}], "testcases": [{"input":"9","output":"9"}]}
	}`)
	p2, err := decodeLegacyProblem(rawNew)
	if err != nil {
		t.Fatalf("decode new problem: %v", err)
	}
	if p2.StatementMD != "新题面" {
		t.Fatalf("statementMd should win over statement: %q", p2.StatementMD)
	}
	var body2 map[string]interface{}
	_ = json.Unmarshal(p2.BodyJSON, &body2)
	if cases, ok := body2["testCases"].([]interface{}); !ok || len(cases) != 1 {
		t.Fatalf("existing testCases should be kept: %+v", body2)
	}
}

func TestParseProblemsJSONLegacyLayouts(t *testing.T) {
	// 1. 嵌套目录 + 旧字段
	zipData := buildTestZip(t, map[string][]byte{
		"myexport/problems.json": []byte(`[{
			"type": "programming",
			"title": "嵌套目录旧格式",
			"statement": "旧题面",
			"timeLimit": 1000,
			"memoryLimit": 256,
			"bodyJson": {"testcases": [{"input":"1","output":"2"}]},
			"answerJson": {}
		}]`),
	})
	problems, err := parseProblemsJSON(zipData)
	if err != nil {
		t.Fatalf("nested layout parse failed: %v", err)
	}
	if len(problems) != 1 || problems[0].Title != "嵌套目录旧格式" || problems[0].StatementMD != "旧题面" {
		t.Fatalf("unexpected nested layout result: %+v", problems)
	}

	// 2. problem.json 别名 + {problems:[...]} 包装
	zipData2 := buildTestZip(t, map[string][]byte{
		"problem.json": []byte(`{"problems":[{"type":"single_choice","title":"包装格式","bodyJson":{"options":["A","B"]},"answerJson":{"answer":"A"}}]}`),
	})
	problems2, err := parseProblemsJSON(zipData2)
	if err != nil {
		t.Fatalf("wrapped alias parse failed: %v", err)
	}
	if len(problems2) != 1 || problems2[0].Title != "包装格式" {
		t.Fatalf("unexpected wrapped result: %+v", problems2)
	}

	// 3. 单个题目对象 + 任意文件名（兜底扫描）
	zipData3 := buildTestZip(t, map[string][]byte{
		"random/data.json": []byte(`{"type":"true_false","title":"单题对象","statementMd":"题面","answerJson":{"answer":true}}`),
	})
	problems3, err := parseProblemsJSON(zipData3)
	if err != nil {
		t.Fatalf("single object fallback parse failed: %v", err)
	}
	if len(problems3) != 1 || problems3[0].Title != "单题对象" {
		t.Fatalf("unexpected single object result: %+v", problems3)
	}

	// 4. 完全没有题目文件
	zipData4 := buildTestZip(t, map[string][]byte{
		"readme.txt": []byte("hello"),
	})
	if _, err := parseProblemsJSON(zipData4); err == nil {
		t.Fatal("expected error when no problem file exists")
	}
}

func TestParseTrainingPlanJSONNested(t *testing.T) {
	zipData := buildTestZip(t, map[string][]byte{
		"folder/trainingPlan.json": []byte(`{"title":"旧训练","chapters":[{"title":"第一章","orderNo":1,"problemIds":[0,1]}]}`),
	})
	meta, err := parseTrainingPlanJSON(zipData)
	if err != nil {
		t.Fatalf("nested trainingPlan parse failed: %v", err)
	}
	if meta == nil || meta.Title != "旧训练" || len(meta.Chapters) != 1 || len(meta.Chapters[0].ProblemIDs) != 2 {
		t.Fatalf("unexpected training plan result: %+v", meta)
	}

	if meta2, err := parseTrainingPlanJSON(buildTestZip(t, map[string][]byte{"problems.json": []byte(`[]`)})); err != nil || meta2 != nil {
		t.Fatalf("missing trainingPlan.json should return nil, got %+v err=%v", meta2, err)
	}
}

func TestExtractZipImagesAnyDepth(t *testing.T) {
	oldUploadDir := uploadDir
	uploadDir = t.TempDir()
	defer func() { uploadDir = oldUploadDir }()

	zipData := buildTestZip(t, map[string][]byte{
		"images/a.png":          []byte("png-a"),
		"export/images/b.png":   []byte("png-b"),
		"cover.jpg":             []byte("jpg-cover"),
		"readme.txt":            []byte("not an image"),
		"sub/notes/webp.webp":   []byte("webp-notes"),
	})
	imageMap, err := extractZipImages(zipData)
	if err != nil {
		t.Fatalf("extract images: %v", err)
	}
	for _, name := range []string{"a.png", "b.png", "cover.jpg", "webp.webp"} {
		if imageMap[name] != "/api/uploads/"+name {
			t.Fatalf("missing image %s in map: %+v", name, imageMap)
		}
		if _, err := os.Stat(filepath.Join(uploadDir, name)); err != nil {
			t.Fatalf("image %s not written to upload dir: %v", name, err)
		}
	}
	if _, ok := imageMap["readme.txt"]; ok {
		t.Fatal("readme.txt should not be treated as an image")
	}
}
