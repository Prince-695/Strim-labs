package domain_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMaskSensitiveHeaders(t *testing.T) {
	headers := map[string]string{
		"Authorization": "Bearer super-secret-jwt-token",
		"X-API-Key":     "secret-key-12345",
		"Cookie":        "session_id=abcdef123",
		"Content-Type":  "application/json",
		"Accept":        "*/*",
	}

	masked := domain.MaskSensitiveHeaders(headers)
	assert.Equal(t, "***", masked["Authorization"])
	assert.Equal(t, "***", masked["X-API-Key"])
	assert.Equal(t, "***", masked["Cookie"])
	assert.Equal(t, "application/json", masked["Content-Type"])
	assert.Equal(t, "*/*", masked["Accept"])

	assert.Nil(t, domain.MaskSensitiveHeaders(nil))
}

func TestLoadTestModel_TableNames(t *testing.T) {
	assert.Equal(t, "load_tests", domain.LoadTest{}.TableName())
	assert.Equal(t, "load_test_results", domain.LoadTestResults{}.TableName())
	assert.Equal(t, "load_test_timeseries", domain.LoadTestTimeseries{}.TableName())
	assert.Equal(t, "jobs", domain.Job{}.TableName())
}

func TestLoadTestDTO_Serialization(t *testing.T) {
	now := time.Now().UTC()
	resp := domain.LoadTestResponse{
		ID:        "test-uuid-123",
		OrgID:     "org-uuid-456",
		ProjectID: "proj-uuid-789",
		Name:      "Checkout Ramp",
		Model:     domain.ModelOpen,
		Profile:   domain.ProfileRamp,
		Status:    domain.LoadTestStatusQueued,
		Config: domain.LoadTestConfig{
			Targets: []domain.LoadTestTarget{
				{
					Method: "POST",
					Path:   "/orders",
					Headers: map[string]string{
						"Authorization": "***",
					},
					Weight: 1,
				},
			},
			StartRate:       10,
			PeakRate:        500,
			RampUpSeconds:   120,
			DurationSeconds: 300,
		},
		CreatedBy: "user-123",
		CreatedAt: now,
		UpdatedAt: now,
	}

	data, err := json.Marshal(resp)
	require.NoError(t, err)

	var decoded domain.LoadTestResponse
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "test-uuid-123", decoded.ID)
	assert.Equal(t, domain.ModelOpen, decoded.Model)
	assert.Equal(t, domain.ProfileRamp, decoded.Profile)
	assert.Equal(t, domain.LoadTestStatusQueued, decoded.Status)
	assert.Equal(t, 1, len(decoded.Config.Targets))
	assert.Equal(t, "***", decoded.Config.Targets[0].Headers["Authorization"])
}
