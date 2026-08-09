package api

import (
	"encoding/json"
	"testing"
)

func TestCollectProblemImageRefs(t *testing.T) {
	problems := []problemExportEntry{
		// 纯十六进制文件名（随机上传生成）
		{StatementMD: "![](/api/uploads/9c6cde295e8c48a1a00d55e6850b1174.png)"},
		// UUID 带连字符文件名
		{BodyJSON: json.RawMessage(`{"options":["![](/api/uploads/fc9f0099-a743-4dfb-bab0-f16d6e6b0005.png)"]}`)},
		// 旧版序号文件名（img_xxxx）
		{AnswerJSON: json.RawMessage(`{"answer":"![](/api/uploads/img_0001.png)"}`)},
		// HTML 形式引用
		{StatementMD: `<img src="/api/uploads/45db19af-3de5-4779-8ecd-1d8303a70611.png" />`},
	}

	refs := collectProblemImageRefs(problems)
	want := map[string]bool{
		"9c6cde295e8c48a1a00d55e6850b1174.png":     true,
		"fc9f0099-a743-4dfb-bab0-f16d6e6b0005.png": true,
		"img_0001.png": true,
		"45db19af-3de5-4779-8ecd-1d8303a70611.png": true,
	}
	if len(refs) != len(want) {
		t.Fatalf("got %d refs %v, want %d", len(refs), refs, len(want))
	}
	for _, r := range refs {
		if !want[r] {
			t.Errorf("unexpected ref %q", r)
		}
	}
}

func TestImageRefPatternRejectsNonUploads(t *testing.T) {
	cases := []string{
		"![](/api/uploads/../../etc/passwd)", // 路径穿越不应匹配
		"正文提到 /api/uploads/ 但无文件名",           // 无文件名不应匹配
	}
	for _, c := range cases {
		if m := imageRefPattern.FindStringSubmatch(c); m != nil {
			t.Errorf("expected no match for %q, got %v", c, m[1])
		}
	}
}
