package loadengine

import (
	"math"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// CalculateTargetRate computes the target requests-per-second (RPS) for second t (0 <= t < duration).
func CalculateTargetRate(profile domain.LoadTestProfile, cfg domain.LoadTestConfig, second int) float64 {
	if second < 0 {
		second = 0
	}

	switch profile {
	case domain.ProfileSustained:
		if cfg.StartRate > 0 {
			return cfg.StartRate
		}
		return cfg.PeakRate

	case domain.ProfileRamp:
		if cfg.RampUpSeconds <= 0 {
			return cfg.PeakRate
		}
		if second < cfg.RampUpSeconds {
			fraction := float64(second) / float64(cfg.RampUpSeconds)
			rate := cfg.StartRate + fraction*(cfg.PeakRate-cfg.StartRate)
			return math.Max(0, rate)
		}
		return cfg.PeakRate

	case domain.ProfileSpike:
		if cfg.Spike == nil {
			if cfg.StartRate > 0 {
				return cfg.StartRate
			}
			return cfg.PeakRate
		}
		spikeStart := cfg.Spike.SpikeAtSeconds
		spikeEnd := spikeStart + cfg.Spike.SpikeDurationSeconds
		if second >= spikeStart && second < spikeEnd {
			return cfg.Spike.SpikeRate
		}
		return cfg.Spike.BaseRate

	case domain.ProfileStep:
		if cfg.Step == nil {
			if cfg.StartRate > 0 {
				return cfg.StartRate
			}
			return cfg.PeakRate
		}
		stepSeconds := cfg.Step.StepSeconds
		if stepSeconds <= 0 {
			stepSeconds = 30
		}
		stepIndex := second / stepSeconds
		rate := cfg.Step.StartRate + float64(stepIndex)*cfg.Step.StepRate
		if cfg.Step.MaxRate > 0 && rate > cfg.Step.MaxRate {
			rate = cfg.Step.MaxRate
		}
		return math.Max(0, rate)

	default:
		return cfg.StartRate
	}
}
