package judge

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"orangeoj/backend/internal/model"
)

type RunnerConfig struct {
	ImageCPP    string
	ImagePython string
	ImageGo     string
	CPU         string
}

type RunResult struct {
	Verdict   model.Verdict
	Stdout    string
	Stderr    string
	TimeMS    int
	MemoryKiB int
	ExitCode  int
}

type DockerRunner struct {
	cfg RunnerConfig
}

func NewDockerRunner(cfg RunnerConfig) *DockerRunner {
	return &DockerRunner{cfg: cfg}
}

func (r *DockerRunner) Run(ctx context.Context, submissionID int64, language string, sourceCode string, input string, timeLimitMS int, memoryLimitMiB int) RunResult {
	if timeLimitMS <= 0 {
		timeLimitMS = 1000
	}
	if memoryLimitMiB <= 0 {
		memoryLimitMiB = 256
	}
	if memoryLimitMiB < 32 {
		memoryLimitMiB = 32
	}

	image, script, fileName, err := r.buildCommand(language)
	if err != nil {
		return RunResult{Verdict: model.VerdictRE, Stderr: err.Error()}
	}

	codeB64 := base64.StdEncoding.EncodeToString([]byte(sourceCode))
	inputB64 := base64.StdEncoding.EncodeToString([]byte(input))

	name := fmt.Sprintf("orangeoj-job-%d-%d", submissionID, time.Now().UnixNano())
	memoryArg := fmt.Sprintf("%dm", memoryLimitMiB)

	args := []string{
		"run", "--rm",
		"--name", name,
		"--network", "none",
		"--user", "65534:65534",
		"--read-only",
		"--pids-limit", "128",
		"--cpus", r.cfg.CPU,
		"--memory", memoryArg,
		"--memory-swap", memoryArg,
		"--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
		"--tmpfs", "/work:rw,exec,nosuid,size=128m",
		"-w", "/work",
		"-e", "CODE_B64=" + codeB64,
		"-e", "INPUT_B64=" + inputB64,
		"-e", "SRC_FILE=" + fileName,
		image,
		"sh", "-lc", script,
	}

	runCtx, cancel := context.WithTimeout(ctx, time.Duration(timeLimitMS+250)*time.Millisecond)
	defer cancel()
	cmd := exec.CommandContext(runCtx, "docker", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	start := time.Now()
	err = cmd.Run()
	took := int(time.Since(start).Milliseconds())
	outStr := stdout.String()
	errStr := stderr.String()

	if runCtx.Err() == context.DeadlineExceeded {
		_ = exec.Command("docker", "rm", "-f", name).Run()
		return RunResult{
			Verdict: model.VerdictTLE,
			Stdout:  outStr,
			Stderr:  trimTo(errStr+"\nTime limit exceeded", 8000),
			TimeMS:  timeLimitMS,
		}
	}

	exitCode := 0
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			exitCode = exitErr.ExitCode()
		}
	}

	if exitCode == 30 {
		return RunResult{Verdict: model.VerdictCE, Stdout: trimTo(outStr, 8000), Stderr: trimTo(errStr, 8000), TimeMS: took}
	}
	if exitCode == 137 || strings.Contains(strings.ToLower(errStr), "out of memory") || strings.Contains(errStr, "Killed") {
		return RunResult{Verdict: model.VerdictMLE, Stdout: trimTo(outStr, 8000), Stderr: trimTo(errStr, 8000), TimeMS: took}
	}
	if err != nil {
		return RunResult{Verdict: model.VerdictRE, Stdout: trimTo(outStr, 8000), Stderr: trimTo(errStr, 8000), TimeMS: took, ExitCode: exitCode}
	}
	return RunResult{Verdict: model.VerdictOK, Stdout: trimTo(outStr, 8000), Stderr: trimTo(errStr, 8000), TimeMS: took}
}

func (r *DockerRunner) buildCommand(language string) (image string, script string, fileName string, err error) {
	switch strings.ToLower(language) {
	case "cpp", "c++":
		image = r.cfg.ImageCPP
		fileName = "main.cpp"
		script = strings.Join([]string{
			`echo "$CODE_B64" | base64 -d > "$SRC_FILE"`,
			`echo "$INPUT_B64" | base64 -d > input.txt`,
			`g++ -std=c++17 -O2 "$SRC_FILE" -o main.out 2> compile.err`,
			`if [ $? -ne 0 ]; then cat compile.err >&2; exit 30; fi`,
			`./main.out < input.txt`,
		}, " && ")
	case "python", "python3", "py":
		image = r.cfg.ImagePython
		fileName = "main.py"
		script = strings.Join([]string{
			`echo "$CODE_B64" | base64 -d > "$SRC_FILE"`,
			`echo "$INPUT_B64" | base64 -d > input.txt`,
			`python3 "$SRC_FILE" < input.txt`,
		}, " && ")
	case "go", "golang":
		image = r.cfg.ImageGo
		fileName = "main.go"
		script = strings.Join([]string{
			`echo "$CODE_B64" | base64 -d > "$SRC_FILE"`,
			`echo "$INPUT_B64" | base64 -d > input.txt`,
			`go build -o main.out "$SRC_FILE" 2> compile.err`,
			`if [ $? -ne 0 ]; then cat compile.err >&2; exit 30; fi`,
			`./main.out < input.txt`,
		}, " && ")
	default:
		return "", "", "", fmt.Errorf("unsupported language: %s", language)
	}
	return image, script, fileName, nil
}

func trimTo(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "\n...[truncated]"
}

func NormalizeOutput(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		lines[i] = strings.TrimRight(line, " \t")
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}
