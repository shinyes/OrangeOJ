package api

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// handleUpdateProblemSolutions 只更新一道题目的题解数组（语言 / 代码 / Markdown 解读），
// 供编程页面直接管理题解使用，不影响题目的其他字段。
func (a *API) handleUpdateProblemSolutions(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	problemID, err := parseIDParam(c, "problemId")
	if err != nil {
		return err
	}
	if err := a.ensureProblemInSpace(spaceID, problemID); err != nil {
		return err
	}
	var req struct {
		Solutions json.RawMessage `json:"solutions"`
	}
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	normalized, err := normalizeProblemSolutions(req.Solutions)
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, err.Error())
	}
	if _, err := a.DB.Exec(`UPDATE space_problems SET solutions_json=? WHERE id=? AND space_id=?`, string(normalized), problemID, spaceID); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"solutions": decodeProblemSolutions(string(normalized))})
}

// problemSolution 表示一道题目的一个题解：语言、代码、以及 Markdown 格式的题目解读。
// 一道题目可以包含多个题解，题解数组以 solutions_json 形式随题目 JSON 一起存储。
type problemSolution struct {
	Language string `json:"language"`
	Code     string `json:"code"`
	Markdown string `json:"markdown"`
}

// normalizeSolutionLanguage 将常见语言别名归一化为系统内使用的语言标识。
func normalizeSolutionLanguage(language string) string {
	switch strings.ToLower(strings.TrimSpace(language)) {
	case "c++", "cpp", "c":
		return "cpp"
	case "python", "python3", "py", "python 3":
		return "python"
	case "go", "golang":
		return "go"
	case "turtle", "python turtle", "pythonturtle":
		return "turtle"
	default:
		return strings.ToLower(strings.TrimSpace(language))
	}
}

// normalizeProblemSolutions 校验并归一化题解数组。
// 非法输入（非数组）一律归为 []；数组项必须是对象，
// 每项取 language/code/markdown 三个字符串字段，language 归一化后为空的项目会被丢弃。
func normalizeProblemSolutions(raw json.RawMessage) (json.RawMessage, error) {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return json.RawMessage(`[]`), nil
	}
	var items []map[string]interface{}
	if err := json.Unmarshal([]byte(trimmed), &items); err != nil {
		return nil, fmt.Errorf("solutions must be a JSON array")
	}
	normalized := make([]problemSolution, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		solution := problemSolution{
			Language: normalizeSolutionLanguage(stringFromAny(item["language"])),
			Code:     strings.TrimSpace(stringFromAny(item["code"])),
			Markdown: strings.TrimSpace(stringFromAny(item["markdown"])),
		}
		if solution.Language == "" {
			continue
		}
		normalized = append(normalized, solution)
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(payload), nil
}

// decodeProblemSolutions 解析存储的 solutions_json；解析失败时返回空数组。
func decodeProblemSolutions(raw string) json.RawMessage {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return json.RawMessage(`[]`)
	}
	var items []problemSolution
	if err := json.Unmarshal([]byte(trimmed), &items); err != nil {
		return json.RawMessage(`[]`)
	}
	payload, err := json.Marshal(items)
	if err != nil {
		return json.RawMessage(`[]`)
	}
	return json.RawMessage(payload)
}
