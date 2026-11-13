package loadengine_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/loadengine"
	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/sse"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWorker_ProcessJob_Success(t *testing.T) {
	var requestCount atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount.Add(1)
		// Verify decrypted auth header was transmitted
		authHeader := r.Header.Get("Authorization")
		if authHeader == "Bearer secret-token" {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusUnauthorized)
		}
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	jobRepo := repository.NewInMemoryJobRepository()
	loadTestRepo := repository.NewInMemoryLoadTestRepository()
	projectRepo := repository.NewInMemoryProjectRepository()
	sseHub := sse.NewHub()
	cryptoKey := "my-secret-key-for-test-32-chars"

	// 1. Create Project
	proj := &domain.Project{
		ID:                 "proj-1",
		OrgID:              "org-1",
		Name:               "Test Project",
		Slug:               "test-proj",
		BaseURL:            server.URL,
		VerificationStatus: domain.StatusVerified,
		CreatedAt:          time.Now().UTC(),
		UpdatedAt:          time.Now().UTC(),
	}
	require.NoError(t, projectRepo.CreateWithLimitCheck(ctx, proj))

	// Encrypt auth header
	encryptedAuth, err := crypto.EncryptAESGCM("Bearer secret-token", cryptoKey)
	require.NoError(t, err)

	// 2. Create LoadTest
	cfg := domain.LoadTestConfig{
		Model:   domain.ModelOpen,
		Profile: domain.ProfileSustained,
		Targets: []domain.LoadTestTarget{
			{
				Method: "GET",
				Path:   "/test",
				Headers: map[string]string{
					"Authorization": encryptedAuth,
				},
				Weight: 1,
			},
		},
		StartRate:       10,
		DurationSeconds: 1,
		MaxVirtualUsers: 10,
		TimeoutMS:       1000,
	}

	cfgBytes, err := json.Marshal(cfg)
	require.NoError(t, err)
	var cfgMap domain.JSONMap
	require.NoError(t, json.Unmarshal(cfgBytes, &cfgMap))

	loadTest := &domain.LoadTest{
		ID:        "test-1",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Name:      "Test Run",
		Model:     domain.ModelOpen,
		Profile:   domain.ProfileSustained,
		Status:    domain.LoadTestStatusQueued,
		Config:    cfgMap,
		CreatedBy: "user-1",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	require.NoError(t, loadTestRepo.Create(ctx, loadTest))

	// 3. Enqueue Job
	payloadBytes, _ := json.Marshal(loadengine.JobPayload{
		TestID:    "test-1",
		ProjectID: "proj-1",
		OrgID:     "org-1",
	})

	job := &domain.Job{
		ID:        "job-1",
		Type:      "load_test_run",
		Payload:   string(payloadBytes),
		Status:    domain.JobStatusQueued,
		RunAt:     time.Now().UTC(),
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	require.NoError(t, jobRepo.EnqueueJob(ctx, job))

	capacityRepo := repository.NewInMemoryCapacityRepository()

	// 4. Run Worker
	worker := loadengine.NewWorker(
		"worker-test",
		jobRepo,
		loadTestRepo,
		projectRepo,
		capacityRepo,
		loadengine.NewEngine(),
		sseHub,
		cryptoKey,
		nil,
	)

	workerCtx, workerCancel := context.WithCancel(ctx)
	go worker.Start(workerCtx)

	// Wait for test to finish
	var finishedTest *domain.LoadTest
	for i := 0; i < 50; i++ {
		time.Sleep(50 * time.Millisecond)
		finishedTest, _ = loadTestRepo.FindByID(ctx, "test-1")
		if finishedTest != nil && (finishedTest.Status == domain.LoadTestStatusCompleted || finishedTest.Status == domain.LoadTestStatusFailed) {
			break
		}
	}
	workerCancel()

	require.NotNil(t, finishedTest)
	assert.Equal(t, domain.LoadTestStatusCompleted, finishedTest.Status)
	assert.NotNil(t, finishedTest.StartedAt)
	assert.NotNil(t, finishedTest.FinishedAt)

	// Verify Results stored
	results, err := loadTestRepo.GetResults(ctx, "test-1")
	require.NoError(t, err)
	require.NotNil(t, results)
	assert.NotEmpty(t, results.Summary)

	// Verify CapacityReport automatically generated & stored
	capReport, err := capacityRepo.FindByLoadTestID(ctx, "test-1")
	require.NoError(t, err)
	require.NotNil(t, capReport)
	assert.Equal(t, "test-1", capReport.LoadTestID)
	assert.Equal(t, "proj-1", capReport.ProjectID)
}
