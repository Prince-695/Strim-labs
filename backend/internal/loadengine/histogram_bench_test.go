package loadengine

import (
	"testing"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/histogram"
)

func BenchmarkHistogram_Add(b *testing.B) {
	h := histogram.NewHistogram()
	latencies := []float64{0.5, 1.2, 5.8, 12.4, 45.0, 99.9, 150.0, 350.2, 1200.0}
	numLats := len(latencies)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		h.Add(latencies[i%numLats])
	}
}

func BenchmarkAggregator_Record(b *testing.B) {
	agg := NewAggregator("test-bench-agg")
	target := domain.LoadTestTarget{
		Method: "GET",
		Path:   "/api/checkout",
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		agg.Record(target, 200, 45.0, 1024, false)
	}
}

func BenchmarkAggregator_RecordParallel(b *testing.B) {
	agg := NewAggregator("test-bench-agg-parallel")
	target := domain.LoadTestTarget{
		Method: "POST",
		Path:   "/api/payments",
	}

	b.ResetTimer()
	b.ReportAllocs()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			agg.Record(target, 201, 85.0, 2048, false)
		}
	})
}
