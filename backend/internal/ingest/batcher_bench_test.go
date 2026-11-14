package ingest

import (
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

func BenchmarkBatcher_EnqueueSequential(b *testing.B) {
	store := NewInMemoryTimeSeriesStore()
	batcher := NewBatcher(BatcherConfig{
		Capacity:      100000,
		BatchSize:     1000,
		FlushInterval: 10 * time.Millisecond,
	}, store, nil, nil)
	batcher.Start()
	defer batcher.Stop()

	event := domain.RequestEvent{
		ProjectID:  "proj-bench",
		Method:     "GET",
		Route:      "/api/v1/bench",
		Status:     200,
		DurationMs: 45,
		Timestamp:  time.Now(),
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_ = batcher.Enqueue(event)
	}
}

func BenchmarkBatcher_EnqueueParallel(b *testing.B) {
	store := NewInMemoryTimeSeriesStore()
	batcher := NewBatcher(BatcherConfig{
		Capacity:      200000,
		BatchSize:     1000,
		FlushInterval: 10 * time.Millisecond,
	}, store, nil, nil)
	batcher.Start()
	defer batcher.Stop()

	event := domain.RequestEvent{
		ProjectID:  "proj-bench-parallel",
		Method:     "POST",
		Route:      "/api/v1/checkout",
		Status:     201,
		DurationMs: 120,
		Timestamp:  time.Now(),
	}

	b.ResetTimer()
	b.ReportAllocs()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = batcher.Enqueue(event)
		}
	})
}
