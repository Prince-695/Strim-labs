package histogram

import (
	"encoding/json"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHistogram_Empty(t *testing.T) {
	h := NewHistogram()
	assert.Equal(t, uint64(0), h.Count)
	assert.Equal(t, 0.0, h.Sum)
	assert.Equal(t, 0.0, h.Quantile(0.5))
	assert.Equal(t, 0.0, h.Quantile(0.99))

	pcts := h.Percentiles()
	assert.Equal(t, 0.0, pcts["p50"])
	assert.Equal(t, 0.0, pcts["p99"])
	assert.Equal(t, 0.0, pcts["min"])
	assert.Equal(t, 0.0, pcts["max"])
	assert.Equal(t, 0.0, pcts["avg"])
}

func TestHistogram_Boundaries(t *testing.T) {
	bounds := BucketBoundaries()
	assert.Equal(t, NumBuckets+1, len(bounds))
	assert.Equal(t, 0.0, bounds[0])
	assert.InDelta(t, MinBoundary, bounds[1], 1e-6)
	assert.InDelta(t, MaxBoundary, bounds[63], 1e-4)

	// Underflow index
	assert.Equal(t, 0, BucketIndex(0.01))
	assert.Equal(t, 0, BucketIndex(0.0))
	assert.Equal(t, 0, BucketIndex(-5.0))

	// Min boundary index
	assert.Equal(t, 1, BucketIndex(MinBoundary))

	// Overflow index
	assert.Equal(t, NumBuckets-1, BucketIndex(MaxBoundary))
	assert.Equal(t, NumBuckets-1, BucketIndex(150000.0))
}

func TestHistogram_AddAndPercentiles(t *testing.T) {
	h := NewHistogram()

	// Add synthetic observations from 1ms to 1000ms
	var values []float64
	for i := 1; i <= 1000; i++ {
		val := float64(i)
		values = append(values, val)
		h.Add(val)
	}

	assert.Equal(t, uint64(1000), h.Count)
	assert.InDelta(t, 500500.0, h.Sum, 1e-4)
	assert.Equal(t, 1.0, h.Min)
	assert.Equal(t, 1000.0, h.Max)

	sort.Float64s(values)
	exactP50 := values[int(0.50*float64(len(values)))]
	exactP90 := values[int(0.90*float64(len(values)))]
	exactP99 := values[int(0.99*float64(len(values)))]

	pcts := h.Percentiles()
	// Histogram with 64 buckets has ~26% resolution per bucket; relative error < 15%
	assert.InDelta(t, exactP50, pcts["p50"], exactP50*0.15)
	assert.InDelta(t, exactP90, pcts["p90"], exactP90*0.15)
	assert.InDelta(t, exactP99, pcts["p99"], exactP99*0.15)
	assert.InDelta(t, 500.5, pcts["avg"], 1e-4)
	assert.Equal(t, 1.0, pcts["min"])
	assert.Equal(t, 1000.0, pcts["max"])
}

func TestHistogram_EdgeQuantiles(t *testing.T) {
	h := NewHistogram()
	h.Add(10.0)
	h.Add(20.0)
	h.Add(30.0)

	assert.Equal(t, 10.0, h.Quantile(0.0))
	assert.Equal(t, 10.0, h.Quantile(-0.5))
	assert.Equal(t, 30.0, h.Quantile(1.0))
	assert.Equal(t, 30.0, h.Quantile(1.5))
}

func TestHistogram_Merge(t *testing.T) {
	h1 := NewHistogram()
	h2 := NewHistogram()

	for i := 1; i <= 500; i++ {
		h1.Add(float64(i))
	}
	for i := 501; i <= 1000; i++ {
		h2.Add(float64(i))
	}

	hMerged := NewHistogram()
	hMerged.Merge(h1)
	hMerged.Merge(h2)

	assert.Equal(t, uint64(1000), hMerged.Count)
	assert.InDelta(t, 500500.0, hMerged.Sum, 1e-4)
	assert.Equal(t, 1.0, hMerged.Min)
	assert.Equal(t, 1000.0, hMerged.Max)

	// Single histogram comparison
	hDirect := NewHistogram()
	for i := 1; i <= 1000; i++ {
		hDirect.Add(float64(i))
	}

	assert.Equal(t, hDirect.Buckets, hMerged.Buckets)
	assert.InDelta(t, hDirect.Quantile(0.95), hMerged.Quantile(0.95), 1e-6)
}

func TestHistogram_BinarySerialization(t *testing.T) {
	h := NewHistogram()
	h.Add(0.02) // underflow
	h.Add(12.5)
	h.Add(250.0)
	h.Add(150000.0) // overflow

	data := h.ToBytes()
	require.Equal(t, 548, len(data))

	restored, err := FromBytes(data)
	require.NoError(t, err)
	assert.Equal(t, h.Count, restored.Count)
	assert.InDelta(t, h.Sum, restored.Sum, 1e-6)
	assert.InDelta(t, h.Min, restored.Min, 1e-6)
	assert.InDelta(t, h.Max, restored.Max, 1e-6)
	assert.Equal(t, h.Buckets, restored.Buckets)
	assert.InDelta(t, h.Quantile(0.50), restored.Quantile(0.50), 1e-6)
}

func TestHistogram_JSONFallbackSerialization(t *testing.T) {
	h := NewHistogram()
	h.Add(15.0)
	h.Add(45.0)

	jsonData, err := json.Marshal(h)
	require.NoError(t, err)

	restored, err := FromBytes(jsonData)
	require.NoError(t, err)
	assert.Equal(t, h.Count, restored.Count)
	assert.InDelta(t, h.Sum, restored.Sum, 1e-6)
	assert.Equal(t, h.Buckets, restored.Buckets)
}

func TestHistogram_FromBytes_Empty(t *testing.T) {
	restored, err := FromBytes(nil)
	require.NoError(t, err)
	assert.Equal(t, uint64(0), restored.Count)

	restoredEmpty, err := FromBytes([]byte{})
	require.NoError(t, err)
	assert.Equal(t, uint64(0), restoredEmpty.Count)
}
