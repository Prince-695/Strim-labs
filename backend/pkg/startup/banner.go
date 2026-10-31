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
	ansiMagenta      = "\033[35m"
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

// PrintBanner writes the formatted box banner to the supplied writer.
func PrintBanner(w io.Writer, cfg Config) {
	fmt.Fprint(w, FormatBanner(cfg))
}

// FormatBanner renders the box-style startup banner as a string.
func FormatBanner(cfg Config) string {
	useColor := !cfg.NoColor && os.Getenv("NO_COLOR") == ""

	// Ensure reasonable defaults
	if cfg.ServiceName == "" {
		if cfg.IsWorker {
			cfg.ServiceName = "STRIM Labs Background Worker"
		} else {
			cfg.ServiceName = "STRIM Labs API Server"
		}
	}
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

	// Resolve Base URL & Endpoints
	baseURL := strings.TrimRight(cfg.APIBaseURL, "/")
	if baseURL == "" && cfg.Port != "" {
		baseURL = fmt.Sprintf("http://localhost:%s", cfg.Port)
	}

	healthURL := cfg.HealthEndpoint
	if healthURL == "" {
		healthURL = "/health"
	}
	if baseURL != "" && strings.HasPrefix(healthURL, "/") {
		healthURL = baseURL + healthURL
	}

	docsURL := cfg.DocsEndpoint
	if docsURL != "" && baseURL != "" && strings.HasPrefix(docsURL, "/") {
		docsURL = baseURL + docsURL
	}

	runtimeInfo := fmt.Sprintf("%s (%s/%s)", runtime.Version(), runtime.GOOS, runtime.GOARCH)

	const innerWidth = 72

	// Helper for coloring
	colorize := func(code, text string) string {
		if !useColor || code == "" {
			return text
		}
		return code + text + ansiReset
	}

	var sb strings.Builder

	// Top Border: ╭──────...──────╮
	sb.WriteString("\n")
	sb.WriteString(colorize(ansiCyan, "╭"+strings.Repeat("─", innerWidth)+"╮") + "\n")

	// Empty Spacing Line
	sb.WriteString(formatBoxLine("", innerWidth, useColor, ansiCyan) + "\n")

	// ASCII Art Logo Header
	logoLines := []string{
		`   ███████╗████████╗██████╗ ██╗███╗   ███╗    ██╗      █████╗ ██████╗   `,
		`   ██╔════╝╚══██╔══╝██╔══██╗██║████╗ ████║    ██║     ██╔══██╗██╔══██╗  `,
		`   ███████╗   ██║   ██████╔╝██║██╔████╔██║    ██║     ███████║██████╔╝  `,
		`   ╚════██║   ██║   ██╔══██╗██║██║╚██╔╝██║    ██║     ██╔══██║██╔══██╗  `,
		`   ███████║   ██║   ██║  ██║██║██║ ╚═╝ ██║    ███████╗██║  ██║██████╔╝  `,
		`   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝    ╚══════╝╚═╝  ╚═╝╚═════╝   `,
	}
	for _, line := range logoLines {
		sb.WriteString(formatBoxLine(colorize(ansiBrightCyan, line), innerWidth, useColor, ansiCyan) + "\n")
	}

	// Subtitle
	sb.WriteString(formatBoxLine("", innerWidth, useColor, ansiCyan) + "\n")
	tagline := "   High-Performance Observability, Testing & Resilience Engine"
	sb.WriteString(formatBoxLine(colorize(ansiGray, tagline), innerWidth, useColor, ansiCyan) + "\n")

	// Divider: ├──────...──────┤
	sb.WriteString(colorize(ansiCyan, "├"+strings.Repeat("─", innerWidth)+"┤") + "\n")

	// Formatted Metadata Items
	items := []struct {
		Label string
		Value string
	}{
		{Label: "Service", Value: colorize(ansiBrightWhite+ansiBold, cfg.ServiceName)},
		{Label: "Version", Value: fmt.Sprintf("%s %s", colorize(ansiWhite, "v"+strings.TrimPrefix(cfg.Version, "v")), colorize(ansiGray, "(commit: "+cfg.Commit+")"))},
		{Label: "Environment", Value: formatEnv(cfg.Environment, colorize)},
		{Label: "Go Runtime", Value: colorize(ansiWhite, runtimeInfo)},
	}

	if !cfg.IsWorker {
		if baseURL != "" {
			items = append(items, struct {
				Label string
				Value string
			}{Label: "API Base URL", Value: colorize(ansiBrightCyan, baseURL)})
		}
		if healthURL != "" {
			items = append(items, struct {
				Label string
				Value string
			}{Label: "Health Probe", Value: colorize(ansiBrightGreen, healthURL)})
		}
		if docsURL != "" {
			items = append(items, struct {
				Label string
				Value string
			}{Label: "API Docs", Value: colorize(ansiYellow, docsURL)})
		}
	} else {
		items = append(items, struct {
			Label string
			Value string
		}{Label: "Worker Mode", Value: colorize(ansiBrightCyan, "Distributed Background Queue & Heartbeat Engine")})
	}

	// Status line
	statusVal := formatStatus(cfg.Status, cfg.StatusDetails, colorize)
	items = append(items, struct {
		Label string
		Value string
	}{Label: "Status", Value: statusVal})

	// Startup Duration
	if cfg.StartupDuration > 0 {
		durationStr := formatDuration(cfg.StartupDuration)
		items = append(items, struct {
			Label string
			Value string
		}{Label: "Startup Time", Value: colorize(ansiBrightGreen, durationStr)})
	}

	for _, item := range items {
		line := fmt.Sprintf("  %-14s: %s", colorize(ansiDim+ansiWhite, item.Label), item.Value)
		sb.WriteString(formatBoxLine(line, innerWidth, useColor, ansiCyan) + "\n")
	}

	// Bottom Border: ╰──────...──────╯
	sb.WriteString(colorize(ansiCyan, "╰"+strings.Repeat("─", innerWidth)+"╯") + "\n\n")

	return sb.String()
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

	return border + content + strings.Repeat(" ", padding) + border
}

// stripANSI removes ANSI escape sequences to compute exact visual column width.
func stripANSI(s string) string {
	return ansiRegex.ReplaceAllString(s, "")
}

func formatEnv(env string, colorize func(code, text string) string) string {
	lower := strings.ToLower(env)
	switch lower {
	case "production", "prod":
		return colorize(ansiBrightYellow+ansiBold, strings.ToUpper(lower))
	case "staging", "stage":
		return colorize(ansiMagenta+ansiBold, strings.ToUpper(lower))
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
