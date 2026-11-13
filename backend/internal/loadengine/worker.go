package loadengine

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/analysis"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/sse"
	"github.com/google/uuid"
)

// JobPayload specifies the payload structure for asynchronous load test jobs.
type JobPayload struct {
	TestID    string `json:"test_id"`
	ProjectID string `json:"project_id"`
	OrgID     string `json:"org_id"`
}

// Worker processes queued load tests, executing them against targets and streaming progress.
type Worker struct {
	workerID     string
	jobRepo      repository.JobRepository
	loadTestRepo repository.LoadTestRepository
	projectRepo  repository.ProjectRepository
	capacityRepo repository.CapacityRepository
	engine       Engine
	sseHub       *sse.Hub
	cryptoKey    string
	logger       *slog.Logger

	mu          sync.Mutex
	activeTests map[string]context.CancelFunc
}

// NewWorker initializes a new load testing worker daemon.
func NewWorker(
	workerID string,
	jobRepo repository.JobRepository,
	loadTestRepo repository.LoadTestRepository,
	projectRepo repository.ProjectRepository,
	capacityRepo repository.CapacityRepository,
	engine Engine,
	sseHub *sse.Hub,
	cryptoKey string,
	logger *slog.Logger,
) *Worker {
	if workerID == "" {
		workerID = "worker-" + uuid.NewString()[:8]
	}
	if logger == nil {
		logger = slog.Default()
	}
	if engine == nil {
		engine = NewEngine()
	}

	return &Worker{
		workerID:     workerID,
		jobRepo:      jobRepo,
		loadTestRepo: loadTestRepo,
		projectRepo:  projectRepo,
		capacityRepo: capacityRepo,
		engine:       engine,
		sseHub:       sseHub,
		cryptoKey:    cryptoKey,
		logger:       logger,
		activeTests:  make(map[string]context.CancelFunc),
	}
}

// Start runs the worker polling loop until the context is canceled.
func (w *Worker) Start(ctx context.Context) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	staleCheckTicker := time.NewTicker(30 * time.Second)
	defer staleCheckTicker.Stop()

	w.logger.Info("Load test worker started", slog.String("worker_id", w.workerID))

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("Load test worker shutting down", slog.String("worker_id", w.workerID))
			return

		case <-staleCheckTicker.C:
			if reclaimed, err := w.jobRepo.ReclaimStaleJobs(ctx, 5*time.Minute); err == nil && reclaimed > 0 {
				w.logger.Warn("Reclaimed stale crashed jobs", slog.Int64("reclaimed", reclaimed))
			}

		case <-ticker.C:
			job, err := w.jobRepo.ClaimJob(ctx, w.workerID)
			if err != nil {
				w.logger.Error("Failed to claim job", slog.Any("error", err))
				continue
			}
			if job == nil {
				continue
			}

			go w.processJob(ctx, job)
		}
	}
}

// CancelTest cancels an actively executing load test locally.
func (w *Worker) CancelTest(testID string) bool {
	w.mu.Lock()
	defer w.mu.Unlock()

	cancel, exists := w.activeTests[testID]
	if exists && cancel != nil {
		cancel()
		return true
	}
	return false
}

func (w *Worker) processJob(parentCtx context.Context, job *domain.Job) {
	var payload JobPayload
	if err := json.Unmarshal([]byte(job.Payload), &payload); err != nil {
		w.logger.Error("Malformed job payload", slog.String("job_id", job.ID), slog.Any("error", err))
		_ = w.jobRepo.FailJob(parentCtx, job.ID, "malformed payload: "+err.Error())
		return
	}

	test, err := w.loadTestRepo.FindByID(parentCtx, payload.TestID)
	if err != nil || test == nil {
		w.logger.Error("Load test not found for job", slog.String("test_id", payload.TestID))
		_ = w.jobRepo.FailJob(parentCtx, job.ID, "load test not found")
		return
	}

	project, err := w.projectRepo.FindOnlyByID(parentCtx, payload.ProjectID)
	if err != nil || project == nil {
		w.logger.Error("Project not found for job", slog.String("project_id", payload.ProjectID))
		_ = w.jobRepo.FailJob(parentCtx, job.ID, "project not found")
		return
	}

	// Unmarshal config
	configBytes, err := json.Marshal(test.Config)
	if err != nil {
		_ = w.jobRepo.FailJob(parentCtx, job.ID, "failed to marshal test config: "+err.Error())
		return
	}

	var cfg domain.LoadTestConfig
	if err := json.Unmarshal(configBytes, &cfg); err != nil {
		_ = w.jobRepo.FailJob(parentCtx, job.ID, "failed to unmarshal test config: "+err.Error())
		return
	}
	cfg.Model = test.Model
	cfg.Profile = test.Profile

	// Decrypt any stored encrypted authentication headers
	if w.cryptoKey != "" {
		for i := range cfg.Targets {
			for k, v := range cfg.Targets[i].Headers {
				if decrypted, decErr := crypto.DecryptAESGCM(v, w.cryptoKey); decErr == nil && decrypted != "" {
					cfg.Targets[i].Headers[k] = decrypted
				}
			}
		}
	}

	// Update status to running
	now := time.Now().UTC()
	test.Status = domain.LoadTestStatusRunning
	test.StartedAt = &now
	_ = w.loadTestRepo.Update(parentCtx, test)

	topic := fmt.Sprintf("loadtest:%s", test.ID)

	// Broadcast initial SSE snapshot
	if w.sseHub != nil {
		w.broadcastSSE(topic, "snapshot", domain.SSEProgressSnapshotData{
			Status:         domain.LoadTestStatusRunning,
			ElapsedSeconds: 0,
			ConfigSummary: map[string]interface{}{
				"profile":   test.Profile,
				"model":     test.Model,
				"peak_rate": cfg.PeakRate,
			},
		})
	}

	// Register test cancellation context
	testCtx, testCancel := context.WithCancel(parentCtx)
	w.mu.Lock()
	w.activeTests[test.ID] = testCancel
	w.mu.Unlock()

	defer func() {
		w.mu.Lock()
		delete(w.activeTests, test.ID)
		w.mu.Unlock()
	}()

	// Heartbeat ticker
	hbDone := make(chan struct{})
	go func() {
		hbTicker := time.NewTicker(5 * time.Second)
		defer hbTicker.Stop()
		for {
			select {
			case <-hbDone:
				return
			case <-hbTicker.C:
				_ = w.jobRepo.HeartbeatJob(parentCtx, job.ID, w.workerID)
			}
		}
	}()

	var timeseriesBatch []*domain.LoadTestTimeseries
	var batchMu sync.Mutex

	onTick := func(ts *domain.LoadTestTimeseries, tick domain.SSEProgressTickData) {
		batchMu.Lock()
		timeseriesBatch = append(timeseriesBatch, ts)
		if len(timeseriesBatch) >= 10 {
			toFlush := timeseriesBatch
			timeseriesBatch = nil
			batchMu.Unlock()
			_ = w.loadTestRepo.CreateTimeseriesBatch(parentCtx, toFlush)
		} else {
			batchMu.Unlock()
		}

		if w.sseHub != nil {
			w.broadcastSSE(topic, "tick", tick)
		}
	}

	// Run load engine
	results, hist, runErr := w.engine.Run(testCtx, test.ID, project.BaseURL, cfg, onTick)
	close(hbDone)

	// Flush any remaining timeseries points
	batchMu.Lock()
	if len(timeseriesBatch) > 0 {
		_ = w.loadTestRepo.CreateTimeseriesBatch(parentCtx, timeseriesBatch)
		timeseriesBatch = nil
	}
	batchMu.Unlock()

	// Determine final test status
	finishTime := time.Now().UTC()
	test.FinishedAt = &finishTime

	var finalStatus domain.LoadTestStatus
	if testCtx.Err() != nil {
		finalStatus = domain.LoadTestStatusStopped
	} else if runErr != nil {
		finalStatus = domain.LoadTestStatusFailed
		errMsg := runErr.Error()
		test.ErrorMessage = &errMsg
	} else {
		finalStatus = domain.LoadTestStatusCompleted
	}
	test.Status = finalStatus
	_ = w.loadTestRepo.Update(parentCtx, test)

	// Store results in database
	summaryJSON, _ := toJSONMap(results.Summary)
	perEndpointJSON, _ := toJSONMap(results.PerEndpoint)
	distJSON, _ := toJSONMap(results.LatencyDistribution)
	flagsJSON, _ := toJSONMap(results.Flags)

	var histBytes []byte
	if hist != nil {
		histBytes = hist.ToBytes()
	}

	loadTestResults := &domain.LoadTestResults{
		TestID:              test.ID,
		Summary:             summaryJSON,
		PerEndpoint:         perEndpointJSON,
		LatencyDistribution: distJSON,
		Flags:               flagsJSON,
		Histogram:           histBytes,
		CreatedAt:           finishTime,
	}
	_ = w.loadTestRepo.CreateResults(parentCtx, loadTestResults)

	// Automatically compute and persist CapacityReport if repository is configured
	if w.capacityRepo != nil && (finalStatus == domain.LoadTestStatusCompleted || finalStatus == domain.LoadTestStatusStopped) {
		tsList, _ := w.loadTestRepo.GetTimeseries(parentCtx, test.ID, 1)
		var thresholds domain.CapacityThresholds
		if cfg.CapacityThresholds != nil {
			thresholds = *cfg.CapacityThresholds
		}
		flags := &domain.LoadTestFlags{
			GeneratorSaturated: results.Flags.GeneratorSaturated,
			MaxScheduleLagMS:   results.Flags.MaxScheduleLagMS,
		}
		capacityReport := analysis.AnalyzeCapacity(test, tsList, thresholds, flags)
		_ = w.capacityRepo.Save(parentCtx, capacityReport)
	}

	// Broadcast final SSE events
	if w.sseHub != nil {
		w.broadcastSSE(topic, "status", domain.SSEProgressStatusData{
			Status: finalStatus,
		})
		w.broadcastSSE(topic, "end", domain.SSEProgressEndData{
			Reason: string(finalStatus),
		})
	}

	// Mark job completed in job queue
	_ = w.jobRepo.CompleteJob(parentCtx, job.ID)
}

func (w *Worker) broadcastSSE(topic, event string, data interface{}) {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return
	}
	w.sseHub.Broadcast(topic, sse.Event{
		Event: event,
		Data:  dataBytes,
	})
}

func toJSONMap(v interface{}) (domain.JSONMap, error) {
	bytes, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var res domain.JSONMap
	if err := json.Unmarshal(bytes, &res); err != nil {
		// If v is a slice rather than a map, wrap it
		var slice []interface{}
		if errSlice := json.Unmarshal(bytes, &slice); errSlice == nil {
			return domain.JSONMap{"items": slice}, nil
		}
		return nil, err
	}
	return res, nil
}
