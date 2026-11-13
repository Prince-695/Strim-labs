package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/loadengine"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/google/uuid"
)

// LoadTestService orchestrates validation, queueing, execution, stopping, and results retrieval of load tests.
type LoadTestService interface {
	CreateLoadTest(ctx context.Context, orgID, projectID, userID string, req domain.CreateLoadTestRequest, idempotencyKey string) (*domain.LoadTestResponse, error)
	GetLoadTest(ctx context.Context, orgID, projectID, testID string) (*domain.LoadTestDetailResponse, error)
	ListLoadTests(ctx context.Context, orgID, projectID string, query repository.ListLoadTestsQuery) ([]*domain.LoadTestResponse, int64, error)
	StopLoadTest(ctx context.Context, orgID, projectID, testID string) (*domain.LoadTestResponse, error)
	RerunLoadTest(ctx context.Context, orgID, projectID, testID, userID string) (*domain.LoadTestResponse, error)
	DeleteLoadTest(ctx context.Context, orgID, projectID, testID string) error
	GetResults(ctx context.Context, orgID, projectID, testID string) (*domain.LoadTestResultsResponse, error)
	GetTimeseries(ctx context.Context, orgID, projectID, testID string, stepStr string) (*domain.LoadTestTimeseriesResponse, error)
}

type loadTestService struct {
	loadTestRepo repository.LoadTestRepository
	projectRepo  repository.ProjectRepository
	jobRepo      repository.JobRepository
	worker       *loadengine.Worker
	ssrfGuard    *netguard.SSRFGuard
	cryptoKey    string
	clk          clock.Clock
}

// NewLoadTestService instantiates a LoadTestService.
func NewLoadTestService(
	loadTestRepo repository.LoadTestRepository,
	projectRepo repository.ProjectRepository,
	jobRepo repository.JobRepository,
	worker *loadengine.Worker,
	ssrfGuard *netguard.SSRFGuard,
	cryptoKey string,
	clk clock.Clock,
) LoadTestService {
	if clk == nil {
		clk = clock.NewRealClock()
	}
	return &loadTestService{
		loadTestRepo: loadTestRepo,
		projectRepo:  projectRepo,
		jobRepo:      jobRepo,
		worker:       worker,
		ssrfGuard:    ssrfGuard,
		cryptoKey:    cryptoKey,
		clk:          clk,
	}
}

func (s *loadTestService) CreateLoadTest(
	ctx context.Context,
	orgID, projectID, userID string,
	req domain.CreateLoadTestRequest,
	idempotencyKey string,
) (*domain.LoadTestResponse, error) {
	// 1. Verify Project exists in Tenant
	project, err := s.projectRepo.FindByID(ctx, orgID, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, domain.NewNotFoundError(fmt.Sprintf("project %s", projectID))
	}

	// 2. Safety Rule: Project must be verified (TARGET_NOT_VERIFIED)
	if project.VerificationStatus != domain.StatusVerified {
		return nil, domain.NewAppError(
			422,
			domain.ErrCodeTargetNotVerified,
			"Project target domain has not been verified",
			nil,
		).WithDetails(map[string]string{
			"verify_url": fmt.Sprintf("/v1/organizations/%s/projects/%s/verification", orgID, projectID),
		})
	}

	// 3. Safety Rule: SSRF Validation on Target Base URL (TARGET_BLOCKED)
	if s.ssrfGuard != nil {
		if _, err := s.ssrfGuard.ValidateTargetURL(ctx, project.BaseURL); err != nil {
			return nil, err
		}
	}

	// 4. Plan Limits / Caps Enforcement (PLAN_LIMIT_EXCEEDED)
	if req.StartRate > 1000 || req.PeakRate > 1000 {
		return nil, domain.NewAppError(422, domain.ErrCodePlanLimitExceeded, "Requested rate exceeds plan cap (1,000 RPS)", nil).
			WithDetails(map[string]interface{}{"field": "rate", "cap": 1000})
	}
	if req.MaxVirtualUsers > 500 {
		return nil, domain.NewAppError(422, domain.ErrCodePlanLimitExceeded, "Requested virtual users exceed plan cap (500 VUs)", nil).
			WithDetails(map[string]interface{}{"field": "max_virtual_users", "cap": 500})
	}
	if req.DurationSeconds > 1800 {
		return nil, domain.NewAppError(422, domain.ErrCodePlanLimitExceeded, "Duration exceeds plan cap (1,800 seconds / 30 minutes)", nil).
			WithDetails(map[string]interface{}{"field": "duration_seconds", "cap": 1800})
	}
	if len(req.Targets) > 20 {
		return nil, domain.NewAppError(422, domain.ErrCodePlanLimitExceeded, "Targets exceed plan cap (max 20 endpoints)", nil).
			WithDetails(map[string]interface{}{"field": "targets", "cap": 20})
	}

	// Validate target paths
	baseParsed, err := url.Parse(project.BaseURL)
	if err != nil {
		return nil, domain.NewBadRequestError("Invalid project base URL", err)
	}

	for _, tgt := range req.Targets {
		// Reject full URLs targeting external domains different from base host
		if strings.HasPrefix(tgt.Path, "http://") || strings.HasPrefix(tgt.Path, "https://") {
			targetParsed, parseErr := url.Parse(tgt.Path)
			if parseErr != nil || !strings.EqualFold(targetParsed.Hostname(), baseParsed.Hostname()) {
				return nil, domain.NewAppError(422, domain.ErrCodeTargetBlocked, "Target endpoint path must resolve to project's verified base host", nil)
			}
		}
	}

	// 5. Concurrent Test Lock (TEST_ALREADY_RUNNING)
	activeProjTest, err := s.loadTestRepo.FindActiveByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if activeProjTest != nil {
		return nil, domain.NewAppError(409, domain.ErrCodeTestAlreadyRunning, "Another load test is currently running or queued for this project", nil).
			WithDetails(map[string]string{"active_test_id": activeProjTest.ID})
	}

	activeOrgTest, err := s.loadTestRepo.FindActiveByOrgID(ctx, orgID)
	if err != nil {
		return nil, err
	}
	if activeOrgTest != nil {
		return nil, domain.NewAppError(409, domain.ErrCodeTestAlreadyRunning, "Organization has reached concurrent load test limit (1 active test)", nil).
			WithDetails(map[string]string{"active_test_id": activeOrgTest.ID})
	}

	// 6. Encrypt sensitive target headers (AES-256-GCM)
	storedTargets := make([]domain.LoadTestTarget, len(req.Targets))
	for i, t := range req.Targets {
		encryptedHeaders := make(map[string]string, len(t.Headers))
		for k, v := range t.Headers {
			lowerKey := strings.ToLower(k)
			if s.cryptoKey != "" && (strings.Contains(lowerKey, "auth") || strings.Contains(lowerKey, "token") || strings.Contains(lowerKey, "cookie") || strings.Contains(lowerKey, "secret") || strings.Contains(lowerKey, "key")) {
				enc, encErr := crypto.EncryptAESGCM(v, s.cryptoKey)
				if encErr == nil {
					encryptedHeaders[k] = enc
				} else {
					encryptedHeaders[k] = v
				}
			} else {
				encryptedHeaders[k] = v
			}
		}

		storedTargets[i] = domain.LoadTestTarget{
			EndpointID: t.EndpointID,
			Method:     t.Method,
			Path:       t.Path,
			Headers:    encryptedHeaders,
			Body:       t.Body,
			Weight:     t.Weight,
		}
	}

	cfg := domain.LoadTestConfig{
		Model:              req.Model,
		Profile:            req.Profile,
		Targets:            storedTargets,
		StartRate:          req.StartRate,
		PeakRate:           req.PeakRate,
		RampUpSeconds:      req.RampUpSeconds,
		DurationSeconds:    req.DurationSeconds,
		MaxVirtualUsers:    req.MaxVirtualUsers,
		TotalRequests:      req.TotalRequests,
		TimeoutMS:          req.TimeoutMS,
		ThinkTimeMS:        req.ThinkTimeMS,
		Spike:              req.Spike,
		Step:               req.Step,
		CapacityThresholds: req.CapacityThresholds,
	}

	cfgBytes, err := json.Marshal(cfg)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	var cfgMap domain.JSONMap
	if err := json.Unmarshal(cfgBytes, &cfgMap); err != nil {
		return nil, domain.NewInternalError(err)
	}

	now := s.clk.Now().UTC()
	status := domain.LoadTestStatusQueued
	if !req.StartNow {
		status = domain.LoadTestStatusDraft
	}

	test := &domain.LoadTest{
		ID:        uuid.NewString(),
		OrgID:     orgID,
		ProjectID: projectID,
		Name:      req.Name,
		Model:     req.Model,
		Profile:   req.Profile,
		Status:    status,
		Config:    cfgMap,
		CreatedBy: userID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.loadTestRepo.Create(ctx, test); err != nil {
		return nil, err
	}

	// Enqueue in job queue if queued
	if status == domain.LoadTestStatusQueued {
		payloadBytes, _ := json.Marshal(loadengine.JobPayload{
			TestID:    test.ID,
			ProjectID: projectID,
			OrgID:     orgID,
		})
		job := &domain.Job{
			ID:        uuid.NewString(),
			Type:      "load_test_run",
			Payload:   string(payloadBytes),
			Status:    domain.JobStatusQueued,
			RunAt:     now,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := s.jobRepo.EnqueueJob(ctx, job); err != nil {
			return nil, err
		}
	}

	return s.buildResponse(test), nil
}

func (s *loadTestService) GetLoadTest(ctx context.Context, orgID, projectID, testID string) (*domain.LoadTestDetailResponse, error) {
	test, err := s.loadTestRepo.FindByID(ctx, testID)
	if err != nil {
		return nil, err
	}
	if test == nil || test.ProjectID != projectID || test.OrgID != orgID {
		return nil, domain.NewNotFoundError(fmt.Sprintf("load_test %s", testID))
	}

	resp := s.buildResponse(test)
	detail := &domain.LoadTestDetailResponse{
		LoadTestResponse: *resp,
	}

	if test.Status == domain.LoadTestStatusCompleted || test.Status == domain.LoadTestStatusStopped {
		if results, err := s.loadTestRepo.GetResults(ctx, testID); err == nil && results != nil {
			if summaryBytes, err := json.Marshal(results.Summary); err == nil {
				var summary domain.LoadTestSummary
				if json.Unmarshal(summaryBytes, &summary) == nil {
					detail.Summary = &summary
				}
			}
		}
	}

	return detail, nil
}

func (s *loadTestService) ListLoadTests(ctx context.Context, orgID, projectID string, query repository.ListLoadTestsQuery) ([]*domain.LoadTestResponse, int64, error) {
	list, total, err := s.loadTestRepo.FindByProjectID(ctx, projectID, query)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]*domain.LoadTestResponse, len(list))
	for i, t := range list {
		responses[i] = s.buildResponse(t)
	}
	return responses, total, nil
}

func (s *loadTestService) StopLoadTest(ctx context.Context, orgID, projectID, testID string) (*domain.LoadTestResponse, error) {
	test, err := s.loadTestRepo.FindByID(ctx, testID)
	if err != nil {
		return nil, err
	}
	if test == nil || test.ProjectID != projectID || test.OrgID != orgID {
		return nil, domain.NewNotFoundError(fmt.Sprintf("load_test %s", testID))
	}

	if test.Status != domain.LoadTestStatusRunning && test.Status != domain.LoadTestStatusQueued {
		return nil, domain.NewAppError(422, domain.ErrCodeNotRunning, "Cannot stop a test that is not running or queued", nil).
			WithDetails(map[string]string{"status": string(test.Status)})
	}

	now := s.clk.Now().UTC()
	test.Status = domain.LoadTestStatusStopped
	test.FinishedAt = &now
	_ = s.loadTestRepo.Update(ctx, test)

	if s.worker != nil {
		s.worker.CancelTest(testID)
	}

	return s.buildResponse(test), nil
}

func (s *loadTestService) RerunLoadTest(ctx context.Context, orgID, projectID, testID, userID string) (*domain.LoadTestResponse, error) {
	test, err := s.loadTestRepo.FindByID(ctx, testID)
	if err != nil {
		return nil, err
	}
	if test == nil || test.ProjectID != projectID || test.OrgID != orgID {
		return nil, domain.NewNotFoundError(fmt.Sprintf("load_test %s", testID))
	}

	cfgBytes, err := json.Marshal(test.Config)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	var cfg domain.LoadTestConfig
	if err := json.Unmarshal(cfgBytes, &cfg); err != nil {
		return nil, domain.NewInternalError(err)
	}

	targetItems := make([]domain.TargetItemRequest, len(cfg.Targets))
	for i, t := range cfg.Targets {
		targetItems[i] = domain.TargetItemRequest(t)
	}

	req := domain.CreateLoadTestRequest{
		Name:               test.Name + " (rerun)",
		Model:              test.Model,
		Profile:            test.Profile,
		Targets:            targetItems,
		StartRate:          cfg.StartRate,
		PeakRate:           cfg.PeakRate,
		RampUpSeconds:      cfg.RampUpSeconds,
		DurationSeconds:    cfg.DurationSeconds,
		MaxVirtualUsers:    cfg.MaxVirtualUsers,
		TotalRequests:      cfg.TotalRequests,
		TimeoutMS:          cfg.TimeoutMS,
		ThinkTimeMS:        cfg.ThinkTimeMS,
		Spike:              cfg.Spike,
		Step:               cfg.Step,
		CapacityThresholds: cfg.CapacityThresholds,
		StartNow:           true,
	}

	return s.CreateLoadTest(ctx, orgID, projectID, userID, req, "")
}

func (s *loadTestService) DeleteLoadTest(ctx context.Context, orgID, projectID, testID string) error {
	test, err := s.loadTestRepo.FindByID(ctx, testID)
	if err != nil {
		return err
	}
	if test == nil || test.ProjectID != projectID || test.OrgID != orgID {
		return domain.NewNotFoundError(fmt.Sprintf("load_test %s", testID))
	}

	if test.Status == domain.LoadTestStatusRunning {
		return domain.NewAppError(409, domain.ErrCodeTestRunning, "Cannot delete a test that is currently running", nil)
	}

	return s.loadTestRepo.Delete(ctx, testID)
}

func (s *loadTestService) GetResults(ctx context.Context, orgID, projectID, testID string) (*domain.LoadTestResultsResponse, error) {
	test, err := s.loadTestRepo.FindByID(ctx, testID)
	if err != nil {
		return nil, err
	}
	if test == nil || test.ProjectID != projectID || test.OrgID != orgID {
		return nil, domain.NewNotFoundError(fmt.Sprintf("load_test %s", testID))
	}

	if test.Status != domain.LoadTestStatusCompleted && test.Status != domain.LoadTestStatusStopped {
		return nil, domain.NewAppError(409, domain.ErrCodeTestNotFinished, "Load test results are only available once the test has finished", nil)
	}

	resRecord, err := s.loadTestRepo.GetResults(ctx, testID)
	if err != nil {
		return nil, err
	}
	if resRecord == nil {
		return nil, domain.NewNotFoundError(fmt.Sprintf("load_test_results %s", testID))
	}

	var summary domain.LoadTestSummary
	if b, err := json.Marshal(resRecord.Summary); err == nil {
		_ = json.Unmarshal(b, &summary)
	}

	var perEndpoint []domain.PerEndpointResult
	if b, err := json.Marshal(resRecord.PerEndpoint); err == nil {
		var wrapper struct {
			Items []domain.PerEndpointResult `json:"items"`
		}
		if json.Unmarshal(b, &wrapper) == nil && len(wrapper.Items) > 0 {
			perEndpoint = wrapper.Items
		} else {
			_ = json.Unmarshal(b, &perEndpoint)
		}
	}

	var dist []domain.LatencyDistributionBucket
	if b, err := json.Marshal(resRecord.LatencyDistribution); err == nil {
		var wrapper struct {
			Items []domain.LatencyDistributionBucket `json:"items"`
		}
		if json.Unmarshal(b, &wrapper) == nil && len(wrapper.Items) > 0 {
			dist = wrapper.Items
		} else {
			_ = json.Unmarshal(b, &dist)
		}
	}

	var flags domain.LoadTestFlags
	if b, err := json.Marshal(resRecord.Flags); err == nil {
		_ = json.Unmarshal(b, &flags)
	}

	return &domain.LoadTestResultsResponse{
		Summary:             summary,
		PerEndpoint:         perEndpoint,
		LatencyDistribution: dist,
		Flags:               flags,
	}, nil
}

func (s *loadTestService) GetTimeseries(ctx context.Context, orgID, projectID, testID string, stepStr string) (*domain.LoadTestTimeseriesResponse, error) {
	test, err := s.loadTestRepo.FindByID(ctx, testID)
	if err != nil {
		return nil, err
	}
	if test == nil || test.ProjectID != projectID || test.OrgID != orgID {
		return nil, domain.NewNotFoundError(fmt.Sprintf("load_test %s", testID))
	}

	stepSeconds := 1
	switch strings.ToLower(strings.TrimSpace(stepStr)) {
	case "5s":
		stepSeconds = 5
	case "10s":
		stepSeconds = 10
	}

	records, err := s.loadTestRepo.GetTimeseries(ctx, testID, stepSeconds)
	if err != nil {
		return nil, err
	}

	points := make([]domain.TimeseriesPointLoadTest, len(records))
	for i, r := range records {
		points[i] = domain.TimeseriesPointLoadTest{
			T:           r.Second,
			OfferedRPS:  r.OfferedRPS,
			AchievedRPS: r.AchievedRPS,
			P50:         r.P50,
			P95:         r.P95,
			P99:         r.P99,
			Errors:      r.Errors,
			Active:      r.Active,
		}
	}

	if stepStr == "" {
		stepStr = "1s"
	}

	return &domain.LoadTestTimeseriesResponse{
		Step:   stepStr,
		Points: points,
	}, nil
}

func (s *loadTestService) buildResponse(test *domain.LoadTest) *domain.LoadTestResponse {
	var cfg domain.LoadTestConfig
	if b, err := json.Marshal(test.Config); err == nil {
		_ = json.Unmarshal(b, &cfg)
	}
	cfg.Model = test.Model
	cfg.Profile = test.Profile

	// Mask sensitive headers
	for i := range cfg.Targets {
		cfg.Targets[i].Headers = domain.MaskSensitiveHeaders(cfg.Targets[i].Headers)
	}

	return &domain.LoadTestResponse{
		ID:           test.ID,
		OrgID:        test.OrgID,
		ProjectID:    test.ProjectID,
		Name:         test.Name,
		Model:        test.Model,
		Profile:      test.Profile,
		Status:       test.Status,
		Config:       cfg,
		CreatedBy:    test.CreatedBy,
		StartedAt:    test.StartedAt,
		FinishedAt:   test.FinishedAt,
		ErrorMessage: test.ErrorMessage,
		CreatedAt:    test.CreatedAt,
		UpdatedAt:    test.UpdatedAt,
	}
}
