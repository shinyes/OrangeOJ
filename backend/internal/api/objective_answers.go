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
		if normalized, ok := normalizeSingleChoiceExpected(answer, options); ok {
			answer["answer"] = normalized
			next, err := json.Marshal(answer)
			if err != nil {
				return err
			}
			req.AnswerJSON = json.RawMessage(next)
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
		if expected, ok := target["answer"]; ok {
			if len(options) > 0 {
				if normalized, matched := canonicalSingleChoiceAnswer(expected, options); matched {
					return normalized, nil
				}
			}
			return expected, nil
		}
		if normalized, ok := normalizeSingleChoiceExpected(target, options); ok {
			return normalized, nil
		}
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

func normalizeSingleChoiceExpected(answer map[string]interface{}, options []string) (string, bool) {
	if len(options) == 0 {
		return "", false
	}

	if value, ok := answer["answer"]; ok {
		return canonicalSingleChoiceAnswer(value, options)
	}

	for _, key := range []string{"correctIndex", "answerIndex", "correctAnswerIndex"} {
		if index, ok := intValueFromAny(answer[key]); ok && index >= 0 && index < len(options) {
			return options[index], true
		}
	}

	for _, key := range []string{"correctOption", "correctLabel", "correctAnswer"} {
		if value, ok := answer[key]; ok {
			if normalized, matched := canonicalSingleChoiceAnswer(value, options); matched {
				return normalized, true
			}
		}
	}

	return "", false
}

func canonicalSingleChoiceAnswer(value interface{}, options []string) (string, bool) {
	raw := strings.TrimSpace(fmt.Sprintf("%v", value))
	if raw == "" {
		return "", false
	}

	for _, option := range options {
		if strings.EqualFold(strings.TrimSpace(option), raw) {
			return option, true
		}
	}

	if index, ok := optionIndexFromLabel(raw); ok && index >= 0 && index < len(options) {
		return options[index], true
	}

	return raw, true
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

func optionIndexFromLabel(raw string) (int, bool) {
	value := strings.TrimSpace(strings.ToUpper(raw))
	if len(value) == 1 && value[0] >= 'A' && value[0] <= 'Z' {
		return int(value[0] - 'A'), true
	}
	return 0, false
}
