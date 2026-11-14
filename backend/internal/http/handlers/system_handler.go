package handlers

import (
	"context"
	"fmt"
	"runtime"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// SystemHandler provides endpoints for system health introspection, liveness/readiness probes, version info, and Prometheus metrics.
type SystemHandler struct {
	systemService service.SystemService
	buildInfo     domain.BuildInfo
	startTime     time.Time
}

// NewSystemHandler creates a new SystemHandler with the given SystemService dependency and build info.
func NewSystemHandler(systemService service.SystemService, buildInfo domain.BuildInfo) *SystemHandler {
	return &SystemHandler{
		systemService: systemService,
		buildInfo:     buildInfo,
		startTime:     time.Now().UTC(),
	}
}

// Health godoc
// @Summary System Health
// @Description Checks if the server is healthy and accepting requests.
// @Tags System
// @Produce json
// @Success 200 {object} domain.Response{data=map[string]string} "System health status"
// @Failure 503 {object} domain.Response "Service dependencies degraded"
// @Router /health [get]
func (h *SystemHandler) Health(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 3*time.Second)
	defer cancel()

	status, err := h.systemService.CheckHealth(ctx)
	if err != nil {
		return domain.NewServiceUnavailableError("Service dependencies degraded", err)
	}

	return domain.SendOK(c, status, nil)
}

// Healthz godoc
// @Summary Liveness Probe
// @Description Instantaneous liveness check indicating the process is alive and responsive.
// @Tags System
// @Produce json
// @Success 200 {object} domain.Response{data=domain.HealthzResponse} "Process is responsive"
// @Router /healthz [get]
func (h *SystemHandler) Healthz(c *fiber.Ctx) error {
	resp := domain.HealthzResponse{
		Status: "ok",
		Time:   time.Now().UTC(),
	}
	return domain.SendOK(c, resp, nil)
}

// Readyz godoc
// @Summary Readiness Probe
// @Description Deep readiness probe checking database connectivity and readiness to serve traffic.
// @Tags System
// @Produce json
// @Success 200 {object} domain.Response{data=domain.ReadyzResponse} "System is ready to serve traffic"
// @Failure 503 {object} domain.Response "Database connectivity degraded"
// @Router /readyz [get]
func (h *SystemHandler) Readyz(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 3*time.Second)
	defer cancel()

	status, err := h.systemService.CheckHealth(ctx)
	if err != nil {
		return domain.NewServiceUnavailableError("Service dependencies degraded", err)
	}

	resp := domain.ReadyzResponse{
		Status:   status["status"],
		Database: status["database"],
	}
	return domain.SendOK(c, resp, nil)
}

// Version godoc
// @Summary Build Version Information
// @Description Exposes server binary version, git commit hash, and build timestamp.
// @Tags System
// @Produce json
// @Success 200 {object} domain.Response{data=domain.BuildInfo} "Build version metadata"
// @Router /v1/version [get]
func (h *SystemHandler) Version(c *fiber.Ctx) error {
	return domain.SendOK(c, h.buildInfo, nil)
}

// Metrics godoc
// @Summary Prometheus Exposition Metrics
// @Description Returns standard line-formatted Prometheus metrics for scraper consumption.
// @Tags System
// @Produce text/plain
// @Success 200 {string} string "Prometheus text-format metrics"
// @Router /metrics [get]
func (h *SystemHandler) Metrics(c *fiber.Ctx) error {
	uptime := time.Since(h.startTime).Seconds()
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	goroutines := runtime.NumGoroutine()

	metricsText := fmt.Sprintf(`# HELP strim_process_uptime_seconds The uptime of the server process in seconds.
# TYPE strim_process_uptime_seconds gauge
strim_process_uptime_seconds %.2f

# HELP strim_go_goroutines Number of goroutines currently existing.
# TYPE strim_go_goroutines gauge
strim_go_goroutines %d

# HELP strim_go_memstats_alloc_bytes Number of bytes allocated and still in use.
# TYPE strim_go_memstats_alloc_bytes gauge
strim_go_memstats_alloc_bytes %d

# HELP strim_go_memstats_total_alloc_bytes Total number of bytes allocated, even if freed.
# TYPE strim_go_memstats_total_alloc_bytes counter
strim_go_memstats_total_alloc_bytes %d

# HELP strim_go_memstats_sys_bytes Number of bytes obtained from system.
# TYPE strim_go_memstats_sys_bytes gauge
strim_go_memstats_sys_bytes %d

# HELP strim_go_memstats_num_gc Number of completed GC cycles.
# TYPE strim_go_memstats_num_gc counter
strim_go_memstats_num_gc %d
`,
		uptime,
		goroutines,
		memStats.Alloc,
		memStats.TotalAlloc,
		memStats.Sys,
		memStats.NumGC,
	)

	c.Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	return c.SendString(metricsText)
}
