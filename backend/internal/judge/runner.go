package judge

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"orangeoj/backend/internal/model"
)

type JudgeCase struct {
	Input    string `json:"input"`
	Expected string `json:"expected"`
}

type JudgeTask struct {
	SubmissionID    int64       `json:"submissionId"`
	Language        string      `json:"language"`
	SourceCode      string      `json:"sourceCode"`
	TimeLimitMS     int         `json:"timeLimitMs"`
	MemoryLimitMiB  int         `json:"memoryLimitMiB"`
	CheckAnswer     bool        `json:"checkAnswer"`
	CompileTimeoutS int         `json:"compileTimeoutS"`
	Cases           []JudgeCase `json:"cases"`
}

type RunResult struct {
	Verdict   model.Verdict `json:"verdict"`
	Stdout    string        `json:"stdout"`
	Stderr    string        `json:"stderr"`
	TimeMS    int           `json:"timeMs"`
	MemoryKiB int           `json:"memoryKiB"`
}

type Runner interface {
	Judge(ctx context.Context, task JudgeTask) (RunResult, error)
}

type HTTPRunner struct {
	endpoint string
	token    string
	client   *http.Client
}

func NewHTTPRunner(endpoint, token string, timeout time.Duration) *HTTPRunner {
	cleanEndpoint := strings.TrimRight(strings.TrimSpace(endpoint), "/")
	if cleanEndpoint == "" {
		cleanEndpoint = "http://judge-runtime:9090"
	}
	if timeout <= 0 {
		timeout = 5 * time.Minute
	}
	return &HTTPRunner{
		endpoint: cleanEndpoint,
		token:    strings.TrimSpace(token),
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

func (r *HTTPRunner) Judge(ctx context.Context, task JudgeTask) (RunResult, error) {
	if strings.TrimSpace(task.Language) == "" {
		return RunResult{}, fmt.Errorf("language is required")
	}
	if strings.TrimSpace(task.SourceCode) == "" {
		return RunResult{}, fmt.Errorf("sourceCode is required")
	}
	if len(task.Cases) == 0 {
		return RunResult{}, fmt.Errorf("judge cases are empty")
	}

	payload, err := json.Marshal(task)
	if err != nil {
		return RunResult{}, err
	}

	endpoint := r.endpoint + "/internal/judge/execute"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return RunResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	if r.token != "" {
		req.Header.Set("X-Judge-Token", r.token)
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return RunResult{}, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		msg := strings.TrimSpace(string(body))
		if msg == "" {
			msg = resp.Status
		}
		return RunResult{}, fmt.Errorf("judge runtime error: %s", msg)
	}

	var result RunResult
	if err := json.Unmarshal(body, &result); err != nil {
		return RunResult{}, fmt.Errorf("invalid judge response: %w", err)
	}
	if result.Verdict == "" {
		return RunResult{}, fmt.Errorf("judge response missing verdict")
	}
	return result, nil
}

func NormalizeOutput(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		lines[i] = strings.TrimRight(line, " \t")
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}
