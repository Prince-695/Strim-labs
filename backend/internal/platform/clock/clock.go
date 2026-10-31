package clock

import "time"

// Clock provides an interface for time operations to make services and load engines testable.
type Clock interface {
	Now() time.Time
	Since(t time.Time) time.Duration
	Sleep(d time.Duration)
}

type realClock struct{}

// NewRealClock returns a Clock backed by the standard time package.
func NewRealClock() Clock {
	return &realClock{}
}

func (r *realClock) Now() time.Time {
	return time.Now().UTC()
}

func (r *realClock) Since(t time.Time) time.Duration {
	return time.Since(t)
}

func (r *realClock) Sleep(d time.Duration) {
	time.Sleep(d)
}

// MockClock is a controllable clock for deterministic unit tests.
type MockClock struct {
	CurrentTime time.Time
}

// NewMockClock returns a mock clock initialized to the given time.
func NewMockClock(t time.Time) *MockClock {
	return &MockClock{CurrentTime: t.UTC()}
}

func (m *MockClock) Now() time.Time {
	return m.CurrentTime
}

func (m *MockClock) Since(t time.Time) time.Duration {
	return m.CurrentTime.Sub(t)
}

func (m *MockClock) Sleep(d time.Duration) {
	m.CurrentTime = m.CurrentTime.Add(d)
}

func (m *MockClock) Advance(d time.Duration) {
	m.CurrentTime = m.CurrentTime.Add(d)
}
