package judgeserver

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"orangeoj/backend/internal/judge"
	"orangeoj/backend/internal/model"
)

type Executor struct {
	workRoot       string
	compileTimeout time.Duration
	cppCompiler    string
	pythonRuntime  string
	goCompiler     string
}

type sandboxResult struct {
	stdout     string
	stderr     string
	durationMS int
	exitCode   int
	timedOut   bool
}

func NewExecutor(workRoot string, compileTimeout time.Duration) (*Executor, error) {
	root := strings.TrimSpace(workRoot)
	if root == "" {
		root = "/work/jobs"
	}
	if compileTimeout <= 0 {
		compileTimeout = 10 * time.Second
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}

	executor := &Executor{
		workRoot:       root,
		compileTimeout: compileTimeout,
	}
	if err := executor.resolveToolchains(); err != nil {
		return nil, err
	}
	if err := executor.selfCheck(); err != nil {
		return nil, err
	}
	return executor, nil
}

func (e *Executor) Execute(ctx context.Context, task judge.JudgeTask) (judge.RunResult, error) {
	if strings.TrimSpace(task.Language) == "" {
		return judge.RunResult{}, fmt.Errorf("language is required")
	}
	if strings.TrimSpace(task.SourceCode) == "" {
		return judge.RunResult{}, fmt.Errorf("sourceCode is required")
	}
	if len(task.Cases) == 0 {
		return judge.RunResult{}, fmt.Errorf("cases are required")
	}

	if task.TimeLimitMS <= 0 {
		task.TimeLimitMS = 1000
	}
	if task.MemoryLimitMiB <= 0 {
		task.MemoryLimitMiB = 256
	}
	if task.MemoryLimitMiB < 32 {
		task.MemoryLimitMiB = 32
	}
	if task.CompileTimeoutS <= 0 {
		task.CompileTimeoutS = int(e.compileTimeout.Seconds())
	}
	if task.CompileTimeoutS <= 0 {
		task.CompileTimeoutS = 10
	}

	language := strings.ToLower(strings.TrimSpace(task.Language))

	jobDir, err := os.MkdirTemp(e.workRoot, fmt.Sprintf("sub-%d-", task.SubmissionID))
	if err != nil {
		return judge.RunResult{}, err
	}
	defer os.RemoveAll(jobDir)

	sourceFile, compileCmd, runCmd, err := e.buildCommands(language)
	if err != nil {
		return judge.RunResult{
			Verdict: model.VerdictRE,
			Stderr:  err.Error(),
		}, nil
	}
	if err := os.WriteFile(filepath.Join(jobDir, sourceFile), []byte(task.SourceCode), 0o600); err != nil {
		return judge.RunResult{}, err
	}

	if compileCmd != "" {
		compileCtx, cancel := context.WithTimeout(ctx, time.Duration(task.CompileTimeoutS)*time.Second)
		compileResult, runErr := runInSandbox(compileCtx, jobDir, compileCmd, "", task.MemoryLimitMiB, task.CompileTimeoutS*1000)
		cancel()
		if runErr != nil {
			return judge.RunResult{}, runErr
		}
		if compileResult.timedOut {
			return judge.RunResult{
				Verdict:   model.VerdictCE,
				Stderr:    trimTo(compileResult.stderr+"\nCompile timeout exceeded", 8000),
				MemoryKiB: task.MemoryLimitMiB * 1024,
			}, nil
		}
		if compileResult.exitCode != 0 {
			return judge.RunResult{
				Verdict:   model.VerdictCE,
				Stdout:    trimTo(compileResult.stdout, 8000),
				Stderr:    trimTo(compileResult.stderr, 8000),
				MemoryKiB: task.MemoryLimitMiB * 1024,
			}, nil
		}
	}

	maxTimeMS := 0
	stdoutBuilder := strings.Builder{}
	stderrBuilder := strings.Builder{}
	caseResults := make([]judge.CaseResult, 0, len(task.Cases))
	verdict := model.VerdictAC
	if !task.CheckAnswer {
		verdict = model.VerdictOK
	}

	for i, tc := range task.Cases {
		caseCtx, cancel := context.WithTimeout(ctx, time.Duration(task.TimeLimitMS+250)*time.Millisecond)
		runResult, runErr := runInSandbox(caseCtx, jobDir, runCmd, tc.Input, task.MemoryLimitMiB, task.TimeLimitMS)
		cancel()
		if runErr != nil {
			return judge.RunResult{}, runErr
		}

		if runResult.durationMS > maxTimeMS {
			maxTimeMS = runResult.durationMS
		}
		stdoutBuilder.WriteString(fmt.Sprintf("[case %d stdout]\n%s\n", i+1, runResult.stdout))
		if runResult.stderr != "" {
			stderrBuilder.WriteString(fmt.Sprintf("[case %d stderr]\n%s\n", i+1, runResult.stderr))
		}

		caseVerdict := model.VerdictAC
		if !task.CheckAnswer {
			caseVerdict = model.VerdictOK
		}
		caseError := runResult.stderr

		if runResult.timedOut {
			if task.TimeLimitMS > maxTimeMS {
				maxTimeMS = task.TimeLimitMS
			}
			stderrBuilder.WriteString(fmt.Sprintf("[case %d stderr]\nTime limit exceeded\n", i+1))
			caseVerdict = model.VerdictTLE
			caseError = trimTo(runResult.stderr+"\nTime limit exceeded", 8000)
			caseResults = append(caseResults, judge.CaseResult{
				CaseNo:         i + 1,
				Verdict:        caseVerdict,
				Input:          tc.Input,
				Output:         runResult.stdout,
				ExpectedOutput: tc.Expected,
				Error:          caseError,
				TimeMS:         task.TimeLimitMS,
				MemoryKiB:      task.MemoryLimitMiB * 1024,
			})
			verdict = model.VerdictTLE
			break
		}
		if isMemoryExceeded(runResult.exitCode, runResult.stderr) {
			caseVerdict = model.VerdictMLE
			caseResults = append(caseResults, judge.CaseResult{
				CaseNo:         i + 1,
				Verdict:        caseVerdict,
				Input:          tc.Input,
				Output:         runResult.stdout,
				ExpectedOutput: tc.Expected,
				Error:          caseError,
				TimeMS:         runResult.durationMS,
				MemoryKiB:      task.MemoryLimitMiB * 1024,
			})
			verdict = model.VerdictMLE
			break
		}
		if runResult.exitCode != 0 {
			caseVerdict = model.VerdictRE
			caseResults = append(caseResults, judge.CaseResult{
				CaseNo:         i + 1,
				Verdict:        caseVerdict,
				Input:          tc.Input,
				Output:         runResult.stdout,
				ExpectedOutput: tc.Expected,
				Error:          caseError,
				TimeMS:         runResult.durationMS,
				MemoryKiB:      task.MemoryLimitMiB * 1024,
			})
			verdict = model.VerdictRE
			break
		}
		if task.CheckAnswer && judge.NormalizeOutput(runResult.stdout) != judge.NormalizeOutput(tc.Expected) {
			stderrBuilder.WriteString(fmt.Sprintf("[case %d] expected:\n%s\n", i+1, tc.Expected))
			caseVerdict = model.VerdictWA
			caseError = trimTo(runResult.stderr+"\nExpected output:\n"+tc.Expected, 8000)
			caseResults = append(caseResults, judge.CaseResult{
				CaseNo:         i + 1,
				Verdict:        caseVerdict,
				Input:          tc.Input,
				Output:         runResult.stdout,
				ExpectedOutput: tc.Expected,
				Error:          caseError,
				TimeMS:         runResult.durationMS,
				MemoryKiB:      task.MemoryLimitMiB * 1024,
			})
			verdict = model.VerdictWA
			break
		}

		caseResults = append(caseResults, judge.CaseResult{
			CaseNo:         i + 1,
			Verdict:        caseVerdict,
			Input:          tc.Input,
			Output:         runResult.stdout,
			ExpectedOutput: tc.Expected,
			Error:          caseError,
			TimeMS:         runResult.durationMS,
			MemoryKiB:      task.MemoryLimitMiB * 1024,
		})
	}

	return judge.RunResult{
		Verdict:     verdict,
		Stdout:      trimTo(stdoutBuilder.String(), 12000),
		Stderr:      trimTo(stderrBuilder.String(), 12000),
		TimeMS:      maxTimeMS,
		MemoryKiB:   task.MemoryLimitMiB * 1024,
		CaseResults: caseResults,
	}, nil
}

func (e *Executor) selfCheck() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	checkDir, err := os.MkdirTemp(e.workRoot, "self-check-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(checkDir)

	result, runErr := runInSandbox(ctx, checkDir, "echo nsjail-ok", "", 64, 2000)
	if runErr != nil {
		return fmt.Errorf("nsjail self-check failed: %w", runErr)
	}
	if result.timedOut || result.exitCode != 0 {
		return fmt.Errorf("nsjail self-check exited abnormally: code=%d stderr=%s", result.exitCode, trimTo(result.stderr, 500))
	}
	if !strings.Contains(result.stdout, "nsjail-ok") {
		return fmt.Errorf("nsjail self-check output invalid: %s", trimTo(result.stdout, 500))
	}
	if err := e.selfCheckCPPToolchain(); err != nil {
		return err
	}
	return nil
}

func (e *Executor) buildCommands(language string) (sourceFile, compileCmd, runCmd string, err error) {
	switch language {
	case "cpp", "c++":
		return "main.cpp", fmt.Sprintf("%s -std=c++17 -O2 main.cpp -o main.out", e.cppCompiler), "./main.out", nil
	case "python", "python3", "py":
		return "main.py", "", fmt.Sprintf("%s main.py", e.pythonRuntime), nil
	case "go", "golang":
		return "main.go", fmt.Sprintf("%s build -o main.out main.go", e.goCompiler), "./main.out", nil
	default:
		return "", "", "", fmt.Errorf("unsupported language: %s", language)
	}
}

func (e *Executor) resolveToolchains() error {
	var err error
	e.cppCompiler, err = resolveExecutablePath("g++", "/usr/bin/g++", "c++", "/usr/bin/c++")
	if err != nil {
		return fmt.Errorf("resolve C++ compiler failed: %w", err)
	}
	e.pythonRuntime, err = resolveExecutablePath("python3", "/usr/bin/python3")
	if err != nil {
		return fmt.Errorf("resolve Python runtime failed: %w", err)
	}
	e.goCompiler, err = resolveExecutablePath("go", "/usr/bin/go")
	if err != nil {
		return fmt.Errorf("resolve Go compiler failed: %w", err)
	}
	return nil
}

func (e *Executor) selfCheckCPPToolchain() error {
	checkDir, err := os.MkdirTemp(e.workRoot, "cpp-self-check-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(checkDir)

	if err := os.WriteFile(filepath.Join(checkDir, "main.cpp"), []byte("int main() { return 0; }\n"), 0o600); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), e.compileTimeout)
	defer cancel()

	compileCmd := fmt.Sprintf("%s -std=c++17 -O2 main.cpp -o main.out", e.cppCompiler)
	result, runErr := runInSandbox(ctx, checkDir, compileCmd, "", 256, int(e.compileTimeout.Milliseconds()))
	if runErr != nil {
		return fmt.Errorf("C++ toolchain self-check failed: %w", runErr)
	}
	if result.timedOut {
		return fmt.Errorf("C++ toolchain self-check timed out")
	}
	if result.exitCode != 0 {
		return fmt.Errorf("C++ toolchain self-check failed: %s", trimTo(strings.TrimSpace(result.stderr), 800))
	}
	return nil
}

func resolveExecutablePath(candidates ...string) (string, error) {
	for _, candidate := range candidates {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		if strings.Contains(candidate, "/") {
			if _, err := os.Stat(candidate); err == nil {
				return candidate, nil
			}
			continue
		}
		resolved, err := exec.LookPath(candidate)
		if err == nil {
			return resolved, nil
		}
	}
	return "", fmt.Errorf("no executable found in candidates: %s", strings.Join(candidates, ", "))
}

func runInSandbox(ctx context.Context, jobDir, command, stdin string, memoryLimitMiB, timeLimitMS int) (sandboxResult, error) {
	result := sandboxResult{}
	if memoryLimitMiB <= 0 {
		memoryLimitMiB = 256
	}
	if memoryLimitMiB < 32 {
		memoryLimitMiB = 32
	}
	if timeLimitMS <= 0 {
		timeLimitMS = 1000
	}

	timeLimitSec := int(math.Ceil(float64(timeLimitMS) / 1000.0))
	if timeLimitSec < 1 {
		timeLimitSec = 1
	}

	memoryBytes := int64(memoryLimitMiB) * 1024 * 1024
	shell := "/bin/sh"
	if _, err := os.Stat(shell); err != nil {
		if _, bashErr := os.Stat("/bin/bash"); bashErr == nil {
			shell = "/bin/bash"
		}
	}

	args := []string{
		"--quiet",
		"--mode", "o",
		"--time_limit", strconv.Itoa(timeLimitSec),
		"--disable_proc",
		"--iface_no_lo",
		"--user", "65534",
		"--group", "65534",
		"--chroot", "/",
		"--cwd", "/sandbox",
		"--bindmount", fmt.Sprintf("%s:/sandbox", jobDir),
		"--use_cgroupv2",
		"--cgroup_mem_max", strconv.FormatInt(memoryBytes, 10),
		"--cgroup_pids_max", "128",
		"--rlimit_as", strconv.FormatInt(memoryBytes, 10),
		"--",
		shell, "-lc", command,
	}

	cmd := exec.CommandContext(ctx, "nsjail", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}

	start := time.Now()
	err := cmd.Run()
	result.durationMS = int(time.Since(start).Milliseconds())
	result.stdout = trimTo(stdout.String(), 8000)
	result.stderr = trimTo(stderr.String(), 8000)

	if ctx.Err() == context.DeadlineExceeded {
		result.timedOut = true
		result.durationMS = timeLimitMS
		return result, nil
	}

	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			result.exitCode = exitErr.ExitCode()
			return result, nil
		}
		return result, fmt.Errorf("start nsjail failed: %w", err)
	}
	result.exitCode = 0
	return result, nil
}

func isMemoryExceeded(exitCode int, stderr string) bool {
	normalizedErr := strings.ToLower(stderr)
	return exitCode == 137 || strings.Contains(normalizedErr, "out of memory") || strings.Contains(normalizedErr, "killed")
}

func trimTo(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "\n...[truncated]"
}
