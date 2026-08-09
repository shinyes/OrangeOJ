package judgeserver

import "testing"

// TestIsTimeoutKill 验证超时被杀（跑满 nsjail 时间上限的 SIGKILL）能正确识别，
// 避免被 isMemoryExceeded 误判成 MLE。
func TestIsTimeoutKill(t *testing.T) {
	cases := []struct {
		name          string
		exitCode      int
		stderr        string
		durationMS    int
		nsjailLimitMS int
		want          bool
	}{
		// 跑满时间预算才被 SIGKILL → 超时
		{"timeout kill via 137", 137, "", 2000, 2000, true},
		{"timeout kill with killed marker", 137, "Killed\n", 1500, 1000, true},
		{"timeout kill slightly over budget", 137, "", 2100, 2000, true},
		// 提前被杀（未跑满预算）→ 不是超时，应判 MLE
		{"oom before limit", 137, "", 800, 2000, false},
		{"killed early", 0, "Killed\n", 500, 2000, false},
		// 正常退出
		{"normal exit zero", 0, "", 300, 2000, false},
		{"normal exit nonzero", 1, "some error\n", 300, 2000, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := sandboxResult{exitCode: tc.exitCode, stderr: tc.stderr, durationMS: tc.durationMS}
			if got := isTimeoutKill(r, tc.nsjailLimitMS); got != tc.want {
				t.Fatalf("isTimeoutKill(%d, %q, %dms, limit %dms) = %v, want %v",
					tc.exitCode, tc.stderr, tc.durationMS, tc.nsjailLimitMS, got, tc.want)
			}
		})
	}
}
