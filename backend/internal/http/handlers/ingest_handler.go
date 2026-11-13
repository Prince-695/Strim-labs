package handlers

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/ingest"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

const (
	MaxCompressedBytes   = 1 * 1024 * 1024 // 1 MB
	MaxUncompressedBytes = 5 * 1024 * 1024 // 5 MB
	MaxBatchEvents       = 1000
)

var validHTTPMethods = map[string]struct{}{
	"GET":     {},
	"POST":    {},
	"PUT":     {},
	"DELETE":  {},
	"PATCH":   {},
	"HEAD":    {},
	"OPTIONS": {},
}

// IngestHandler manages high-throughput telemetry ingestion.
type IngestHandler struct {
	batcher     *ingest.Batcher
	projectRepo repository.ProjectRepository
	clock       clock.Clock
	apiKeySvc   *service.APIKeyService
	usageSvc    *service.UsageService
}

// NewIngestHandler instantiates an IngestHandler.
func NewIngestHandler(batcher *ingest.Batcher, projectRepo repository.ProjectRepository, clk clock.Clock) *IngestHandler {
	if clk == nil {
		clk = clock.NewRealClock()
	}
	return &IngestHandler{
		batcher:     batcher,
		projectRepo: projectRepo,
		clock:       clk,
	}
}

// SetServices attaches optional API key and usage quota services.
func (h *IngestHandler) SetServices(apiKeySvc *service.APIKeyService, usageSvc *service.UsageService) {
	h.apiKeySvc = apiKeySvc
	h.usageSvc = usageSvc
}

// IngestEvents receives batched API request events.
// @Summary Ingest telemetry events
// @Description Ingests batches of up to 1,000 HTTP request telemetry events (gzip supported, <= 1MB compressed, <= 5MB uncompressed)
// @Tags Ingestion
// @Accept json
// @Produce json
// @Param X-API-Key header string false "Project API Key"
// @Param X-Project-ID header string false "Project ID"
// @Param Authorization header string false "Bearer Project API Key"
// @Param project_id query string false "Project ID"
// @Param Content-Encoding header string false "Encoding (e.g. gzip)"
// @Param request body domain.IngestEventsRequest true "Batched telemetry events payload"
// @Success 202 {object} domain.Response{data=domain.IngestEventsResponse}
// @Failure 400 {object} domain.Response
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Failure 429 {object} domain.Response
// @Router /v1/ingest/events [post]
func (h *IngestHandler) IngestEvents(c *fiber.Ctx) error {
	// 1. Authenticate Project / API Key
	rawKey := h.extractRawAPIKey(c)
	var project *domain.Project
	if h.apiKeySvc != nil && strings.HasPrefix(rawKey, "strim_") {
		key, err := h.apiKeySvc.ValidateKey(c.Context(), rawKey, domain.ScopeIngest)
		if err != nil {
			return err
		}
		var projErr error
		project, projErr = h.projectRepo.FindOnlyByID(c.Context(), key.ProjectID)
		if projErr != nil {
			return domain.NewProjectNotFoundError()
		}
	} else {
		projectID := h.extractProjectID(c)
		if projectID == "" {
			return domain.NewUnauthorizedError("API key or Project ID is required via X-API-Key, X-Project-ID, or Authorization header")
		}

		var err error
		project, err = h.projectRepo.FindOnlyByID(c.Context(), projectID)
		if err != nil {
			return domain.NewProjectNotFoundError()
		}
	}

	// 2. Read body with gzip decompression and size checks
	rawBody := c.Body()
	var bodyBytes []byte

	contentEncoding := strings.ToLower(c.Get("Content-Encoding"))
	if strings.Contains(contentEncoding, "gzip") {
		if len(rawBody) > MaxCompressedBytes {
			return domain.NewBadRequestError("Compressed body exceeds maximum limit of 1 MB", nil)
		}

		// Check if fasthttp already decompressed the body
		gzReader, err := gzip.NewReader(bytes.NewReader(rawBody))
		if err != nil {
			// If rawBody is not valid gzip, check if it was already decompressed or if c.BodyRaw() holds raw gzip
			rawBytes := c.Request().Body()
			if gzReader2, err2 := gzip.NewReader(bytes.NewReader(rawBytes)); err2 == nil {
				gzReader = gzReader2
				defer gzReader.Close()
			} else {
				// If fasthttp has already uncompressed it, use rawBody directly if valid JSON
				var testJSON map[string]interface{}
				if jsonErr := json.Unmarshal(rawBody, &testJSON); jsonErr == nil {
					bodyBytes = rawBody
					gzReader = nil
				} else {
					return domain.NewBadRequestError("Malformed gzip compressed payload", err)
				}
			}
		}

		if gzReader != nil {
			defer gzReader.Close()
			limitReader := io.LimitReader(gzReader, int64(MaxUncompressedBytes)+1)
			decompressed, err := io.ReadAll(limitReader)
			if err != nil {
				return domain.NewBadRequestError("Failed to decompress gzip payload", err)
			}
			if len(decompressed) > MaxUncompressedBytes {
				return domain.NewBadRequestError("Decompressed payload exceeds maximum limit of 5 MB", nil)
			}
			bodyBytes = decompressed
		}
	} else {
		if len(rawBody) > MaxUncompressedBytes {
			return domain.NewBadRequestError("Request body exceeds maximum limit of 5 MB", nil)
		}
		bodyBytes = rawBody
	}

	// 3. Parse JSON payload
	var req domain.IngestEventsRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		return domain.NewBadRequestError("Malformed JSON payload", err)
	}

	if len(req.Events) == 0 {
		return domain.NewBadRequestError("Payload must contain at least 1 event", nil)
	}
	if len(req.Events) > MaxBatchEvents {
		return domain.NewBadRequestError("Payload exceeds maximum batch limit of 1,000 events", nil)
	}

	// Check organization plan limit quota
	if h.usageSvc != nil {
		if err := h.usageSvc.CheckEventsQuota(c.Context(), project.OrgID, int64(len(req.Events))); err != nil {
			return err
		}
	}

	// 4. Validate and normalize individual events
	now := h.clock.Now().UTC()
	pastCutoff := now.Add(-24 * time.Hour)
	futureCutoff := now.Add(5 * time.Minute)

	validEvents := make([]domain.RequestEvent, 0, len(req.Events))
	var errorsList []domain.IngestEventError

	for i, item := range req.Events {
		method := strings.ToUpper(strings.TrimSpace(item.Method))
		if _, ok := validHTTPMethods[method]; !ok {
			errorsList = append(errorsList, domain.IngestEventError{
				Index:  i,
				Reason: "invalid HTTP method: " + item.Method,
			})
			continue
		}

		path := strings.TrimSpace(item.Path)
		if path == "" {
			errorsList = append(errorsList, domain.IngestEventError{
				Index:  i,
				Reason: "path cannot be empty",
			})
			continue
		}

		if (item.Status < 100 || item.Status > 599) && item.Status != 0 {
			errorsList = append(errorsList, domain.IngestEventError{
				Index:  i,
				Reason: "status must be between 100 and 599 or 0",
			})
			continue
		}

		if item.DurationMs < 0 {
			errorsList = append(errorsList, domain.IngestEventError{
				Index:  i,
				Reason: "duration_ms must be non-negative",
			})
			continue
		}

		var ts time.Time
		if item.TS == nil || item.TS.IsZero() {
			ts = now
		} else {
			ts = item.TS.UTC()
			if ts.Before(pastCutoff) {
				errorsList = append(errorsList, domain.IngestEventError{
					Index:  i,
					Reason: "event timestamp is older than 24 hours",
				})
				continue
			}
			if ts.After(futureCutoff) {
				errorsList = append(errorsList, domain.IngestEventError{
					Index:  i,
					Reason: "event timestamp is more than 5 minutes in the future",
				})
				continue
			}
		}

		route := strings.TrimSpace(item.Route)
		if route == "" {
			route = discovery.NormalizePath(path)
		}

		isError := false
		if item.Error != nil {
			isError = *item.Error
		} else {
			isError = item.Status >= 400 || item.Status == 0
		}

		bytesCount := item.Bytes
		if bytesCount < 0 {
			bytesCount = 0
		}

		serviceName := strings.TrimSpace(req.Service)

		validEvents = append(validEvents, domain.RequestEvent{
			ProjectID:  project.ID,
			Timestamp:  ts,
			Method:     method,
			Route:      route,
			Status:     item.Status,
			DurationMs: item.DurationMs,
			Bytes:      bytesCount,
			IsError:    isError,
			Service:    serviceName,
		})
	}

	// 5. Enqueue valid events into bounded batcher
	var accepted int
	if len(validEvents) > 0 {
		var err error
		accepted, err = h.batcher.EnqueueBatch(validEvents)
		if err != nil {
			c.Set("Retry-After", "2")
			return err
		}
		if h.usageSvc != nil && accepted > 0 {
			_ = h.usageSvc.RecordIngestedEvents(c.Context(), project.OrgID, int64(accepted))
		}
	}

	resp := domain.IngestEventsResponse{
		Accepted: accepted,
		Rejected: len(req.Events) - accepted,
		Errors:   errorsList,
	}

	return c.Status(fiber.StatusAccepted).JSON(domain.Response{
		Success: true,
		Data:    resp,
	})
}

// extractRawAPIKey retrieves the unstripped raw API key or token.
func (h *IngestHandler) extractRawAPIKey(c *fiber.Ctx) string {
	apiKey := strings.TrimSpace(c.Get("X-API-Key"))
	if apiKey == "" {
		authHeader := strings.TrimSpace(c.Get("Authorization"))
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			apiKey = strings.TrimSpace(authHeader[7:])
		}
	}
	return apiKey
}

// extractProjectID retrieves the project ID or API key from request headers or query.
func (h *IngestHandler) extractProjectID(c *fiber.Ctx) string {
	apiKey := strings.TrimSpace(c.Get("X-API-Key"))
	if apiKey == "" {
		apiKey = strings.TrimSpace(c.Get("X-Project-ID"))
	}
	if apiKey == "" {
		authHeader := strings.TrimSpace(c.Get("Authorization"))
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			apiKey = strings.TrimSpace(authHeader[7:])
		}
	}
	if apiKey == "" {
		apiKey = strings.TrimSpace(c.Query("project_id"))
	}

	// Strip common API key prefixes if present (e.g. strim_live_<uuid> or strim_ingest_<uuid>)
	apiKey = strings.TrimPrefix(apiKey, "strim_live_")
	apiKey = strings.TrimPrefix(apiKey, "strim_ingest_")
	apiKey = strings.TrimPrefix(apiKey, "strim_test_")

	return apiKey
}
