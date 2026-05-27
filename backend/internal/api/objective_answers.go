package api

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

func normalizeObjectiveAnswerPayload(req *problemPayload) error {
	switch req.Type {
	case "single_choice":
		body, err := parseJSONMap(req.BodyJSON, "bodyJson")
		if err != nil {
			return err
		}
		answer, err := parseJSONMap(req.AnswerJSON, "answerJson")
		if err != nil {
			return err
		}
		options := optionStringsFromAny(body["options"])
		if len(options) == 0 {
			return nil
		}
		if index, ok := intValueFromAny(answer["answerIndex"]); ok && index >= 0 && index < len(options) {
			next, err := json.Marshal(map[string]interface{}{"answerIndex": index})
			if err != nil {
				return err
			}
			req.AnswerJSON = json.RawMessage(next)
		} else if answerText, ok := answer["answer"].(string); ok && answerText != "" {
			for i, opt := range options {
				if strings.EqualFold(strings.TrimSpace(answerText), strings.TrimSpace(opt)) {
					next, err := json.Marshal(map[string]interface{}{"answerIndex": i})
					if err != nil {
						return err
					}
					req.AnswerJSON = json.RawMessage(next)
					break
				}
			}
		}
	case "true_false":
		answer, err := parseJSONMap(req.AnswerJSON, "answerJson")
		if err != nil {
			return err
		}
		if normalized, ok := normalizeTrueFalseExpected(answer); ok {
			answer["answer"] = normalized
			next, err := json.Marshal(answer)
			if err != nil {
				return err
			}
			req.AnswerJSON = json.RawMessage(next)
		}
	}
	return nil
}

func expectedObjectiveAnswer(problemType string, answerJSON string, bodyJSON string) (interface{}, error) {
	var target map[string]interface{}
	if err := json.Unmarshal([]byte(answerJSON), &target); err != nil {
		return nil, fmt.Errorf("invalid answer_json")
	}

	switch problemType {
	case "single_choice":
		body := map[string]interface{}{}
		if strings.TrimSpace(bodyJSON) != "" {
			if err := json.Unmarshal([]byte(bodyJSON), &body); err != nil {
				return nil, fmt.Errorf("invalid body_json")
			}
		}
		options := optionStringsFromAny(body["options"])
		if index, ok := intValueFromAny(target["answerIndex"]); ok && index >= 0 && index < len(options) {
			return options[index], nil
		}
		if answerText, ok := target["answer"].(string); ok && answerText != "" {
			for _, opt := range options {
				if strings.EqualFold(strings.TrimSpace(answerText), strings.TrimSpace(opt)) {
					return opt, nil
				}
			}
		}
		return nil, fmt.Errorf("answer_json.answerIndex required")
	case "true_false":
		if expected, ok := target["answer"]; ok {
			if normalized, matched := normalizeTrueFalseExpected(map[string]interface{}{"answer": expected}); matched {
				return normalized, nil
			}
			return expected, nil
		}
		if normalized, ok := normalizeTrueFalseExpected(target); ok {
			return normalized, nil
		}
	default:
		if expected, ok := target["answer"]; ok {
			return expected, nil
		}
	}

	return nil, fmt.Errorf("answer_json.answer required")
}

func parseJSONMap(raw json.RawMessage, fieldLabel string) (map[string]interface{}, error) {
	if len(raw) == 0 {
		return map[string]interface{}{}, nil
	}
	var value map[string]interface{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, fmt.Errorf("%s must be a JSON object", fieldLabel)
	}
	if value == nil {
		return map[string]interface{}{}, nil
	}
	return value, nil
}

func optionStringsFromAny(raw interface{}) []string {
	options, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	result := make([]string, 0, len(options))
	for _, option := range options {
		result = append(result, strings.TrimSpace(fmt.Sprintf("%v", option)))
	}
	return result
}

func normalizeTrueFalseExpected(answer map[string]interface{}) (bool, bool) {
	for _, key := range []string{"answer", "correct", "correctAnswer", "value"} {
		if value, ok := answer[key]; ok {
			normalized, err := toBool(value)
			if err == nil {
				return normalized, true
			}
		}
	}
	return false, false
}

func intValueFromAny(value interface{}) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case int64:
		return int(typed), true
	case float64:
		index := int(typed)
		return index, float64(index) == typed
	case string:
		index, err := strconv.Atoi(strings.TrimSpace(typed))
		return index, err == nil
	default:
		return 0, false
	}
}
