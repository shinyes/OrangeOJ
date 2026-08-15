package api

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"path"
	"strings"
)

// 本文件实现旧版 ZIP 结构的兼容解析，保证老版本导出的题目包仍可导入：
//   - problems.json / trainingPlan.json 可以位于 ZIP 内的任意目录层级（如 export/problems.json）
//   - problems.json 可命名为 problem.json / questions.json，甚至任意 *.json（只要内容可解析为题目数组）
//   - problems.json 内容可以是题目数组、{ "problems": [...] } / { "data": [...] } 包装，或单个题目对象
//   - 旧版字段名自动映射：statement→statementMd、timeLimit→timeLimitMs、memoryLimit→memoryLimitMiB、
//     description→statementMd（statementMd 缺失时）、bodyJson 内 testcases→testCases、examples→samples、
//     input→inputFormat、output→outputFormat

func readZipEntry(f *zip.File) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}

// findZipFileByNames 在 ZIP 中查找 basename 匹配任一候选名的文件。
// 优先匹配根目录下的文件（f.Name 精确等于候选名），其次任意目录深度（path.Base 匹配）。
// 找到则返回文件内容与文件名；未找到返回 (nil, "", nil)。
func findZipFileByNames(reader *zip.Reader, names ...string) ([]byte, string, error) {
	if len(names) == 0 {
		return nil, "", fmt.Errorf("no candidate file names")
	}
	want := make(map[string]bool, len(names))
	for _, n := range names {
		want[n] = true
	}
	// 第一轮：根目录精确匹配
	for _, f := range reader.File {
		if want[f.Name] {
			data, err := readZipEntry(f)
			if err != nil {
				return nil, f.Name, fmt.Errorf("read %s: %w", f.Name, err)
			}
			return data, f.Name, nil
		}
	}
	// 第二轮：任意目录深度按 basename 匹配
	for _, f := range reader.File {
		if want[path.Base(f.Name)] {
			data, err := readZipEntry(f)
			if err != nil {
				return nil, f.Name, fmt.Errorf("read %s: %w", f.Name, err)
			}
			return data, f.Name, nil
		}
	}
	return nil, "", nil
}

// findProblemsJSON 兼容旧版 ZIP 查找题目数据文件：
// 依次尝试 problems.json → problem.json / questions.json / 题目.json（均支持任意目录深度），
// 兜底扫描全部 *.json，返回第一个能解析为题目数组的文件。
func findProblemsJSON(reader *zip.Reader) ([]byte, string, error) {
	for _, names := range [][]string{
		{"problems.json"},
		{"problem.json", "questions.json", "题目.json"},
	} {
		data, name, err := findZipFileByNames(reader, names...)
		if err != nil {
			return nil, name, err
		}
		if data != nil {
			return data, name, nil
		}
	}
	for _, f := range reader.File {
		if !strings.HasSuffix(strings.ToLower(f.Name), ".json") {
			continue
		}
		data, err := readZipEntry(f)
		if err != nil {
			continue
		}
		if _, err := unwrapProblemArray(data); err == nil {
			return data, f.Name, nil
		}
	}
	return nil, "", nil
}

// unwrapProblemArray 兼容旧版 problems.json 的多种容器结构，返回每个题目的原始 JSON 片段：
//  1. 直接是题目数组；
//  2. 对象包装 { "problems": [...] } 或 { "data": [...] }；
//  3. 单个题目对象（带 type 与 title，视为单题列表）。
func unwrapProblemArray(raw []byte) ([]json.RawMessage, error) {
	var parsed interface{}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("invalid problem JSON: %w", err)
	}
	switch v := parsed.(type) {
	case []interface{}:
		items := make([]json.RawMessage, 0, len(v))
		for _, item := range v {
			if item == nil {
				continue
			}
			data, err := json.Marshal(item)
			if err != nil {
				return nil, err
			}
			items = append(items, data)
		}
		return items, nil
	case map[string]interface{}:
		for _, key := range []string{"problems", "data"} {
			if wrapped, ok := v[key]; ok {
				inner, err := json.Marshal(wrapped)
				if err != nil {
					return nil, err
				}
				return unwrapProblemArray(inner)
			}
		}
		// 单个题目对象：同时具备 type 与 title 才视为一道题
		if _, hasType := v["type"]; hasType {
			if _, hasTitle := v["title"]; hasTitle {
				data, err := json.Marshal(v)
				if err != nil {
					return nil, err
				}
				return []json.RawMessage{data}, nil
			}
		}
		return nil, fmt.Errorf("problem JSON must contain a problem array")
	default:
		return nil, fmt.Errorf("problem JSON must contain a problem array")
	}
}

// decodeLegacyProblem 解码单个题目 JSON 并映射旧版字段名到当前格式。
func decodeLegacyProblem(raw json.RawMessage) (*problemPayload, error) {
	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return nil, err
	}
	// 顶层别名：仅当新字段缺失时复制，并删除已消费的旧字段
	alias := func(target, source string) {
		if _, ok := obj[target]; ok {
			return
		}
		if value, ok := obj[source]; ok {
			obj[target] = value
			delete(obj, source)
		}
	}
	alias("statementMd", "statement")
	alias("statementMd", "description")
	alias("timeLimitMs", "timeLimit")
	alias("memoryLimitMiB", "memoryLimit")
	if body, ok := obj["bodyJson"].(map[string]interface{}); ok {
		bodyAlias := func(target, source string) {
			if _, ok := body[target]; ok {
				return
			}
			if value, ok := body[source]; ok {
				body[target] = value
				delete(body, source)
			}
		}
		bodyAlias("testCases", "testcases")
		bodyAlias("samples", "examples")
		bodyAlias("inputFormat", "input")
		bodyAlias("outputFormat", "output")
	}
	fixed, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	var p problemPayload
	if err := json.Unmarshal(fixed, &p); err != nil {
		return nil, err
	}
	return &p, nil
}
