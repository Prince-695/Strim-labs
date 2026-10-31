package clock_test

import (
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/stretchr/testify/assert"
)

func TestMockClock(t *testing.T) {
	initial := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)
	clk := clock.NewMockClock(initial)

	assert.Equal(t, initial, clk.Now())

	clk.Advance(10 * time.Minute)
	assert.Equal(t, initial.Add(10*time.Minute), clk.Now())
	assert.Equal(t, 10*time.Minute, clk.Since(initial))
}

func TestRealClock(t *testing.T) {
	clk := clock.NewRealClock()
	now := clk.Now()
	assert.False(t, now.IsZero())
	time.Sleep(5 * time.Millisecond)
	assert.True(t, clk.Since(now) >= 5*time.Millisecond)
}
