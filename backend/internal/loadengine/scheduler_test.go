package loadengine_test

import (
	"testing"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/loadengine"
	"github.com/stretchr/testify/assert"
)

func TestCalculateTargetRate_Sustained(t *testing.T) {
	cfg := domain.LoadTestConfig{
		StartRate:       50,
		DurationSeconds: 60,
	}

	for sec := 0; sec < 60; sec += 10 {
		rate := loadengine.CalculateTargetRate(domain.ProfileSustained, cfg, sec)
		assert.Equal(t, 50.0, rate)
	}
}

func TestCalculateTargetRate_Ramp(t *testing.T) {
	cfg := domain.LoadTestConfig{
		StartRate:       10,
		PeakRate:        110,
		RampUpSeconds:   100,
		DurationSeconds: 150,
	}

	// At start: 10
	assert.Equal(t, 10.0, loadengine.CalculateTargetRate(domain.ProfileRamp, cfg, 0))
	// At 50s (halfway): 60
	assert.Equal(t, 60.0, loadengine.CalculateTargetRate(domain.ProfileRamp, cfg, 50))
	// At 100s (ramp-up complete): 110
	assert.Equal(t, 110.0, loadengine.CalculateTargetRate(domain.ProfileRamp, cfg, 100))
	// At 120s (sustained at peak): 110
	assert.Equal(t, 110.0, loadengine.CalculateTargetRate(domain.ProfileRamp, cfg, 120))
}

func TestCalculateTargetRate_Spike(t *testing.T) {
	cfg := domain.LoadTestConfig{
		Spike: &domain.SpikeConfig{
			BaseRate:             20,
			SpikeRate:            500,
			SpikeAtSeconds:       30,
			SpikeDurationSeconds: 10,
		},
		DurationSeconds: 60,
	}

	// Before spike
	assert.Equal(t, 20.0, loadengine.CalculateTargetRate(domain.ProfileSpike, cfg, 10))
	// Exactly at spike start
	assert.Equal(t, 500.0, loadengine.CalculateTargetRate(domain.ProfileSpike, cfg, 30))
	// Inside spike
	assert.Equal(t, 500.0, loadengine.CalculateTargetRate(domain.ProfileSpike, cfg, 35))
	// After spike ends (30 + 10 = 40)
	assert.Equal(t, 20.0, loadengine.CalculateTargetRate(domain.ProfileSpike, cfg, 40))
}

func TestCalculateTargetRate_Step(t *testing.T) {
	cfg := domain.LoadTestConfig{
		Step: &domain.StepConfig{
			StartRate:   50,
			StepRate:    25,
			StepSeconds: 10,
			MaxRate:     100,
		},
		DurationSeconds: 60,
	}

	// Step 0: 0-9s -> 50
	assert.Equal(t, 50.0, loadengine.CalculateTargetRate(domain.ProfileStep, cfg, 0))
	assert.Equal(t, 50.0, loadengine.CalculateTargetRate(domain.ProfileStep, cfg, 9))
	// Step 1: 10-19s -> 75
	assert.Equal(t, 75.0, loadengine.CalculateTargetRate(domain.ProfileStep, cfg, 10))
	// Step 2: 20-29s -> 100
	assert.Equal(t, 100.0, loadengine.CalculateTargetRate(domain.ProfileStep, cfg, 20))
	// Step 3: 30-39s -> capped at MaxRate (100)
	assert.Equal(t, 100.0, loadengine.CalculateTargetRate(domain.ProfileStep, cfg, 30))
}
