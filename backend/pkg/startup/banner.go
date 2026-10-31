package startup

import (
	"fmt"
	"io"
	"os"
	"regexp"
	"runtime"
	"strings"
	"time"
	"unicode/utf8"
)

// ANSI Color and Style Codes
const (
	ansiReset        = "\033[0m"
	ansiBold         = "\033[1m"
	ansiDim          = "\033[2m"
	ansiCyan         = "\033[36m"
	ansiBrightCyan   = "\033[96m"
	ansiGreen        = "\033[32m"
	ansiBrightGreen  = "\033[92m"
	ansiYellow       = "\033[33m"
	ansiBrightYellow = "\033[93m"
	ansiWhite        = "\033[37m"
	ansiBrightWhite  = "\033[97m"
	ansiGray         = "\033[90m"
)

var ansiRegex = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

// Config contains runtime and deployment parameters for the startup banner.
type Config struct {
	ServiceName     string
	Version         string
	Commit          string
	Environment     string
	Port            string
	APIBaseURL      string
	HealthEndpoint  string
	DocsEndpoint    string
	Status          string
	StatusDetails   string
	StartupDuration time.Duration
	IsWorker        bool
	NoColor         bool
}

// PrintServerBanner outputs a styled startup banner for the API Server to stdout.
func PrintServerBanner(cfg Config) {
	cfg.IsWorker = false
	PrintBanner(os.Stdout, cfg)
}

// PrintWorkerBanner outputs a styled startup banner for the Background Worker to stdout.
func PrintWorkerBanner(cfg Config) {
	cfg.IsWorker = true
	PrintBanner(os.Stdout, cfg)
}

// PrintBanner writes the formatted compact box banner to the supplied writer.
func PrintBanner(w io.Writer, cfg Config) {
	fmt.Fprint(w, FormatBanner(cfg))
}

// FormatBanner renders a compact, elegant box-style startup banner (Seasyn / Fiber style).
func FormatBanner(cfg Config) string {
	useColor := !cfg.NoColor && os.Getenv("NO_COLOR") == ""

	if cfg.Version == "" {
		cfg.Version = "1.0.0"
	}
	if cfg.Commit == "" {
		cfg.Commit = "dev"
	}
	if cfg.Environment == "" {
		cfg.Environment = "development"
	}
	if cfg.Status == "" {
		cfg.Status = "ONLINE"
	}

	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	baseURL := strings.TrimRight(cfg.APIBaseURL, "/")
	if baseURL == "" {
		baseURL = fmt.Sprintf("http://0.0.0.0:%s", port)
	}

	healthPath := cfg.HealthEndpoint
	if healthPath == "" {
		healthPath = "/health"
	}

	docsPath := cfg.DocsEndpoint
	if docsPath == "" {
		docsPath = "/swagger/index.html"
	}

	// Helper for coloring
	colorize := func(code, text string) string {
		if !useColor || code == "" {
			return text
		}
		return code + text + ansiReset
	}

	const innerWidth = 51

	var sb strings.Builder

	// Top Border:  ┌───────────────────────────────────────────────────┐
	sb.WriteString("\n")
	sb.WriteString(" " + colorize(ansiCyan, "┌"+strings.Repeat("─", innerWidth)+"┐") + "\n")

	// Header Title & Address (Seasyn style)
	if !cfg.IsWorker {
		title := "⚡ STRIM LABS (LABS) · API"
		sb.WriteString(formatCenteredLine(colorize(ansiBold+ansiBrightCyan, title), innerWidth, useColor, ansiCyan) + "\n")

		listenURL := fmt.Sprintf("http://0.0.0.0:%s", port)
		sb.WriteString(formatCenteredLine(colorize(ansiBrightGreen, listenURL), innerWidth, useColor, ansiCyan) + "\n")

		bindDesc := fmt.Sprintf("(bound on host 0.0.0.0 and port %s)", port)
		sb.WriteString(formatCenteredLine(colorize(ansiDim+ansiWhite, bindDesc), innerWidth, useColor, ansiCyan) + "\n")
	} else {
		title := "⚡ STRIM LABS (LABS) · WORKER"
		sb.WriteString(formatCenteredLine(colorize(ansiBold+ansiBrightCyan, title), innerWidth, useColor, ansiCyan) + "\n")

		workerDesc := "(distributed background queue & job processor)"
		sb.WriteString(formatCenteredLine(colorize(ansiDim+ansiWhite, workerDesc), innerWidth, useColor, ansiCyan) + "\n")
	}

	// Spacer Line
	sb.WriteString(formatBoxLine("", innerWidth, useColor, ansiCyan) + "\n")

	// Metadata Rows (with dotted leader)
	runtimeShort := fmt.Sprintf("%s (%s/%s)", runtime.Version(), runtime.GOOS, runtime.GOARCH)

	items := []struct {
		Label string
		Value string
	}{
		{Label: "Environment", Value: formatEnv(cfg.Environment, colorize)},
		{Label: "Version", Value: fmt.Sprintf("%s %s", colorize(ansiWhite, "v"+strings.TrimPrefix(cfg.Version, "v")), colorize(ansiGray, "("+cfg.Commit+")"))},
		{Label: "Runtime", Value: colorize(ansiWhite, runtimeShort)},
		{Label: "Status", Value: formatStatus(cfg.Status, cfg.StatusDetails, colorize)},
	}

	if !cfg.IsWorker {
		items = append(items,
			struct {
				Label string
				Value string
			}{Label: "Health", Value: colorize(ansiBrightCyan, healthPath)},
			struct {
				Label string
				Value string
			}{Label: "Docs", Value: colorize(ansiYellow, docsPath)},
		)
	}

	if cfg.StartupDuration > 0 {
		items = append(items, struct {
			Label string
			Value string
		}{Label: "Startup", Value: colorize(ansiBrightGreen, formatDuration(cfg.StartupDuration))})
	}

	// Render dotted rows
	for _, it := range items {
		line := formatDottedRow(it.Label, it.Value, innerWidth, colorize)
		sb.WriteString(formatBoxLine(line, innerWidth, useColor, ansiCyan) + "\n")
	}

	// Bottom Border:  └───────────────────────────────────────────────────┘
	sb.WriteString(" " + colorize(ansiCyan, "└"+strings.Repeat("─", innerWidth)+"┘") + "\n\n")

	return sb.String()
}

// formatDottedRow builds " Label .......... Value " with exact alignment.
func formatDottedRow(label, value string, innerWidth int, colorize func(code, text string) string) string {
	plainLabel := stripANSI(label)
	plainVal := stripANSI(value)

	// Box interior: 1 leading space + label + 1 space + dots + 1 space + value + 1 trailing space = innerWidth
	dotCount := innerWidth - utf8.RuneCountInString(plainLabel) - utf8.RuneCountInString(plainVal) - 4
	if dotCount < 1 {
		dotCount = 1
	}

	dots := colorize(ansiGray, strings.Repeat(".", dotCount))
	coloredLabel := colorize(ansiWhite, label)

	return fmt.Sprintf(" %s %s %s ", coloredLabel, dots, value)
}

// formatCenteredLine centers text within innerWidth surrounded by borders.
func formatCenteredLine(content string, innerWidth int, useColor bool, borderCode string) string {
	visibleLen := utf8.RuneCountInString(stripANSI(content))
	totalPadding := innerWidth - visibleLen
	if totalPadding < 0 {
		totalPadding = 0
	}

	leftPad := totalPadding / 2
	rightPad := totalPadding - leftPad

	border := "│"
	if useColor && borderCode != "" {
		border = borderCode + border + ansiReset
	}

	return " " + border + strings.Repeat(" ", leftPad) + content + strings.Repeat(" ", rightPad) + border
}

// formatBoxLine wraps text with box borders `│` and pads it to exact innerWidth.
func formatBoxLine(content string, innerWidth int, useColor bool, borderCode string) string {
	visibleLen := utf8.RuneCountInString(stripANSI(content))
	padding := innerWidth - visibleLen
	if padding < 0 {
		padding = 0
	}

	border := "│"
	if useColor && borderCode != "" {
		border = borderCode + border + ansiReset
	}

	return " " + border + content + strings.Repeat(" ", padding) + border
}

// stripANSI removes ANSI escape sequences to compute exact visual column width.
func stripANSI(s string) string {
	return ansiRegex.ReplaceAllString(s, "")
}

func formatEnv(env string, colorize func(code, text string) string) string {
	lower := strings.ToLower(env)
	switch lower {
	case "production", "prod":
		return colorize(ansiBrightYellow+ansiBold, "production")
	case "staging", "stage":
		return colorize(ansiCyan+ansiBold, "staging")
	default:
		return colorize(ansiGreen, lower)
	}
}

func formatStatus(status, details string, colorize func(code, text string) string) string {
	upper := strings.ToUpper(status)
	var coloredStatus string
	switch upper {
	case "ONLINE", "ACTIVE", "READY", "HEALTHY":
		coloredStatus = colorize(ansiBrightGreen+ansiBold, "● "+upper)
	case "DEGRADED", "WARN", "WARNING":
		coloredStatus = colorize(ansiBrightYellow+ansiBold, "▲ "+upper)
	default:
		coloredStatus = colorize(ansiWhite+ansiBold, upper)
	}

	if details != "" {
		return fmt.Sprintf("%s %s", coloredStatus, colorize(ansiGray, "("+details+")"))
	}
	return coloredStatus
}

func formatDuration(d time.Duration) string {
	if d < time.Millisecond {
		return fmt.Sprintf("%dµs", d.Microseconds())
	}
	if d < time.Second {
		return fmt.Sprintf("%.2fms", float64(d.Microseconds())/1000.0)
	}
	return fmt.Sprintf("%.2fs", d.Seconds())
}
