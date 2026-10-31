package startup

import (
	"bytes"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func TestFormatBanner_Server(t *testing.T) {
	cfg := Config{
		ServiceName:     "STRIM Labs API Server",
		Version:         "1.0.0",
		Commit:          "7c8d9e",
		Environment:     "production",
		Port:            "8080",
		APIBaseURL:      "http://localhost:8080",
		HealthEndpoint:  "/health",
		DocsEndpoint:    "/swagger/index.html",
		Status:          "ONLINE",
		StatusDetails:   "Database connected",
		StartupDuration: 12500 * time.Microsecond,
		NoColor:         true,
	}

	banner := FormatBanner(cfg)
	t.Log("\n" + banner)

	// Validate presence of required sections
	expectedSubstrings := []string{
		"STRIM Labs API Server",
		"v1.0.0",
		"commit: 7c8d9e",
		"PRODUCTION",
		"http://localhost:8080",
		"http://localhost:8080/health",
		"http://localhost:8080/swagger/index.html",
		"ONLINE",
		"Database connected",
		"12.50ms",
	}

	for _, sub := range expectedSubstrings {
		if !strings.Contains(banner, sub) {
			t.Errorf("banner missing expected content: %q\nBanner:\n%s", sub, banner)
		}
	}

	// Validate box symmetry: every line must start and end with box characters
	lines := strings.Split(strings.TrimSpace(banner), "\n")
	firstLine := lines[0]
	lastLine := lines[len(lines)-1]

	if !strings.HasPrefix(firstLine, "╭") || !strings.HasSuffix(firstLine, "╮") {
		t.Errorf("expected top border ╭...╮, got: %s", firstLine)
	}
	if !strings.HasPrefix(lastLine, "╰") || !strings.HasSuffix(lastLine, "╯") {
		t.Errorf("expected bottom border ╰...╯, got: %s", lastLine)
	}

	expectedWidth := utf8.RuneCountInString(firstLine)
	for i, line := range lines {
		clean := stripANSI(line)
		width := utf8.RuneCountInString(clean)
		if width != expectedWidth {
			t.Errorf("line %d has inconsistent width: expected %d, got %d. Content: %q", i, expectedWidth, width, clean)
		}
	}
}

func TestFormatBanner_Worker(t *testing.T) {
	cfg := Config{
		ServiceName:     "STRIM Labs Background Worker",
		Version:         "1.0.0",
		Commit:          "dev",
		Environment:     "staging",
		Status:          "ACTIVE",
		StatusDetails:   "Worker pool initialized",
		StartupDuration: 5 * time.Millisecond,
		IsWorker:        true,
		NoColor:         true,
	}

	banner := FormatBanner(cfg)
	t.Log("\n" + banner)

	expectedSubstrings := []string{
		"STRIM Labs Background Worker",
		"v1.0.0",
		"STAGING",
		"ACTIVE",
		"Worker pool initialized",
		"5.00ms",
	}

	for _, sub := range expectedSubstrings {
		if !strings.Contains(banner, sub) {
			t.Errorf("worker banner missing expected content: %q\nBanner:\n%s", sub, banner)
		}
	}

	// Worker banner should NOT have API routes
	if strings.Contains(banner, "Health Probe") {
		t.Errorf("worker banner should not contain Health Probe line")
	}
}

func TestPrintBanner_Writer(t *testing.T) {
	var buf bytes.Buffer
	cfg := Config{
		ServiceName: "Test Service",
		NoColor:     true,
	}

	PrintBanner(&buf, cfg)
	if buf.Len() == 0 {
		t.Errorf("expected output in writer, got 0 bytes")
	}
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		input    time.Duration
		expected string
	}{
		{500 * time.Microsecond, "500µs"},
		{12500 * time.Microsecond, "12.50ms"},
		{1500 * time.Millisecond, "1.50s"},
	}

	for _, tc := range tests {
		got := formatDuration(tc.input)
		if got != tc.expected {
			t.Errorf("formatDuration(%v) = %q, expected %q", tc.input, got, tc.expected)
		}
	}
}
