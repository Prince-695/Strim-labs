package startup

import (
	"fmt"
	"io"
	"os"
	"runtime"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	reset  = "\033[0m"
	bold   = "\033[1m"
	dim    = "\033[2m"
	cyan   = "\033[96m"
	green  = "\033[92m"
	yellow = "\033[93m"
	white  = "\033[97m"
	gray   = "\033[90m"
)

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

func PrintServerBanner(cfg Config) {
	cfg.IsWorker = false
	PrintBanner(os.Stdout, cfg)
}

func PrintWorkerBanner(cfg Config) {
	cfg.IsWorker = true
	PrintBanner(os.Stdout, cfg)
}

func PrintBanner(w io.Writer, cfg Config) {
	fmt.Fprint(w, FormatBanner(cfg))
}

func FormatBanner(cfg Config) string {
	color := !cfg.NoColor && os.Getenv("NO_COLOR") == ""

	style := func(code, value string) string {
		if !color {
			return value
		}
		return code + value + reset
	}

	name := cfg.ServiceName
	if name == "" {
		name = "STRIM LABS"
	}

	version := cfg.Version
	if version == "" {
		version = "1.0.0"
	}
	version = "v" + strings.TrimPrefix(version, "v")

	commit := cfg.Commit
	if commit == "" {
		commit = "dev"
	}

	env := strings.ToLower(cfg.Environment)
	if env == "" {
		env = "development"
	}

	status := strings.ToUpper(cfg.Status)
	if status == "" {
		status = "ONLINE"
	}

	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	apiURL := cfg.APIBaseURL
	if apiURL == "" {
		apiURL = "http://localhost:" + port
	}
	apiURL = strings.TrimRight(apiURL, "/")

	health := cfg.HealthEndpoint
	if health == "" {
		health = "/health"
	}

	docs := cfg.DocsEndpoint
	if docs == "" {
		docs = "/swagger/index.html"
	}

	const width = 52
	border := style(cyan, "│")
	line := style(cyan, " "+strings.Repeat("─", width))

	var b strings.Builder

	b.WriteString("\n")
	b.WriteString(style(cyan, " ╭"+strings.Repeat("─", width)+"╮") + "\n")

	title := name + " · API"
	if cfg.IsWorker {
		title = name + " · WORKER"
	}

	center := func(value string) {
		length := utf8.RuneCountInString(value)
		padding := max(0, width-length)
		left := padding / 2
		right := padding - left

		b.WriteString(" " + border +
			strings.Repeat(" ", left) +
			style(bold+cyan, value) +
			strings.Repeat(" ", right) +
			border + "\n")
	}

	center(title)

	if cfg.IsWorker {
		center("Background Job Processor")
	} else {
		center(apiURL)
	}

	b.WriteString(" " + border + strings.Repeat(" ", width) + border + "\n")
	b.WriteString(" " + line + "\n")

	row := func(label, value string) {
		valueLength := utf8.RuneCountInString(value)
		labelLength := utf8.RuneCountInString(label)
		dots := max(2, width-labelLength-valueLength-5)

		b.WriteString(" " + border + " " +
			style(white, label) + " " +
			style(gray, strings.Repeat(".", dots)) + " " +
			value + " " + border + "\n")
	}

	envColor := green
	if env == "production" || env == "prod" {
		envColor = yellow
	}

	statusColor := green
	if status == "DEGRADED" || status == "WARNING" {
		statusColor = yellow
	}

	row("Environment", style(envColor+bold, env))
	row("Version", style(white, version)+" "+style(gray, "("+commit+")"))
	row("Runtime", style(white, runtime.Version()+" ("+runtime.GOOS+"/"+runtime.GOARCH+")"))
	row("Status", style(statusColor+bold, "● "+status))

	if cfg.StatusDetails != "" {
		row("Details", style(gray, cfg.StatusDetails))
	}

	if !cfg.IsWorker {
		row("API", style(cyan, apiURL))
		row("Health", style(cyan, health))
		row("Docs", style(yellow, docs))
	}

	if cfg.StartupDuration > 0 {
		row("Startup", style(green, cfg.StartupDuration.Round(time.Microsecond).String()))
	}

	b.WriteString(" " + style(cyan, " ╰"+strings.Repeat("─", width)+"╯") + "\n\n")

	return b.String()
}
