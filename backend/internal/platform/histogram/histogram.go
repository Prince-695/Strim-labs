package histogram

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"math"
)

const (
	NumBuckets   = 64
	MinBoundary  = 0.05       // 0.05 ms (50 microseconds)
	MaxBoundary  = 120000.0   // 120,000 ms (120 seconds)
	BinaryHeader = 0x48495354 // "HIST" in ASCII
)

var (
	// boundaries holds the lower and upper bounds for each bucket.
	// boundaries[0] = 0.0
	// boundaries[1] = MinBoundary (0.05)
	// boundaries[63] = MaxBoundary (120000.0)
	// boundaries[64] = +Inf
	boundaries [NumBuckets + 1]float64
	logRatio   float64
	growthRate float64
)

func init() {
	boundaries[0] = 0.0
	boundaries[1] = MinBoundary

	// 62 log intervals between MinBoundary (index 1) and MaxBoundary (index 63)
	growthRate = math.Pow(MaxBoundary/MinBoundary, 1.0/62.0)
	logRatio = math.Log(growthRate)

	for i := 1; i <= 62; i++ {
		boundaries[i] = MinBoundary * math.Pow(growthRate, float64(i-1))
	}
	boundaries[63] = MaxBoundary
	boundaries[64] = math.MaxFloat64
}

// Histogram is a 64-bucket logarithmic histogram with percentile interpolation.
type Histogram struct {
	Count   uint64             `json:"count"`
	Sum     float64            `json:"sum"`
	Min     float64            `json:"min"`
	Max     float64            `json:"max"`
	Buckets [NumBuckets]uint64 `json:"buckets"`
}

// NewHistogram initializes an empty 64-bucket histogram.
func NewHistogram() *Histogram {
	return &Histogram{
		Min: math.MaxFloat64,
		Max: 0.0,
	}
}

// BucketBoundaries returns the precomputed bucket boundaries.
func BucketBoundaries() [NumBuckets + 1]float64 {
	return boundaries
}

// BucketIndex finds the bucket index [0..63] for a given duration in ms.
func BucketIndex(val float64) int {
	if val < MinBoundary {
		return 0
	}
	if val >= MaxBoundary {
		return NumBuckets - 1
	}

	idx := 1 + int(math.Floor(math.Log(val/MinBoundary)/logRatio))
	if idx < 1 {
		idx = 1
	} else if idx >= NumBuckets-1 {
		idx = NumBuckets - 2
	}
	return idx
}

// Add records a duration observation in milliseconds.
func (h *Histogram) Add(val float64) {
	if math.IsNaN(val) || val < 0 {
		val = 0
	}

	idx := BucketIndex(val)
	h.Buckets[idx]++
	h.Count++
	h.Sum += val

	if val < h.Min {
		h.Min = val
	}
	if val > h.Max {
		h.Max = val
	}
}

// Merge combines another histogram into this one.
func (h *Histogram) Merge(other *Histogram) {
	if other == nil || other.Count == 0 {
		return
	}

	if h.Count == 0 {
		*h = *other
		return
	}

	for i := 0; i < NumBuckets; i++ {
		h.Buckets[i] += other.Buckets[i]
	}
	h.Count += other.Count
	h.Sum += other.Sum

	if other.Min < h.Min {
		h.Min = other.Min
	}
	if other.Max > h.Max {
		h.Max = other.Max
	}
}

// Quantile calculates the interpolated percentile for q in [0.0, 1.0].
// e.g. q=0.50 for p50, q=0.99 for p99.
func (h *Histogram) Quantile(q float64) float64 {
	if h.Count == 0 {
		return 0.0
	}

	if q <= 0.0 {
		if h.Min == math.MaxFloat64 {
			return 0.0
		}
		return h.Min
	}
	if q >= 1.0 {
		return h.Max
	}

	targetRank := q * float64(h.Count)
	var cumulative uint64

	for i := 0; i < NumBuckets; i++ {
		count := h.Buckets[i]
		if count == 0 {
			continue
		}

		nextCumulative := cumulative + count
		if float64(nextCumulative) >= targetRank {
			// Quantile falls inside bucket i
			lower := boundaries[i]
			upper := boundaries[i+1]

			if i == 0 {
				lower = 0.0
				upper = MinBoundary
			} else if i == NumBuckets-1 {
				lower = MaxBoundary
				if h.Max > MaxBoundary {
					upper = h.Max
				} else {
					upper = MaxBoundary * 1.5
				}
			}

			// Linear interpolation inside the bucket
			fraction := (targetRank - float64(cumulative)) / float64(count)
			if fraction < 0 {
				fraction = 0
			} else if fraction > 1 {
				fraction = 1
			}

			val := lower + fraction*(upper-lower)
			if val < h.Min {
				val = h.Min
			}
			if val > h.Max {
				val = h.Max
			}
			return val
		}

		cumulative = nextCumulative
	}

	return h.Max
}

// Percentiles calculates standard latency metrics (p50, p90, p95, p99, min, max, avg).
func (h *Histogram) Percentiles() map[string]float64 {
	if h.Count == 0 {
		return map[string]float64{
			"p50": 0, "p90": 0, "p95": 0, "p99": 0,
			"min": 0, "max": 0, "avg": 0,
		}
	}

	minVal := h.Min
	if minVal == math.MaxFloat64 {
		minVal = 0
	}

	return map[string]float64{
		"p50": h.Quantile(0.50),
		"p90": h.Quantile(0.90),
		"p95": h.Quantile(0.95),
		"p99": h.Quantile(0.99),
		"min": minVal,
		"max": h.Max,
		"avg": h.Sum / float64(h.Count),
	}
}

// ToBytes serializes the histogram into a compact binary byte slice (548 bytes).
// Format:
//   - 4 bytes magic header (0x48495354)
//   - 8 bytes Count (uint64)
//   - 8 bytes Sum (float64 bits)
//   - 8 bytes Min (float64 bits)
//   - 8 bytes Max (float64 bits)
//   - 64 * 8 bytes = 512 bytes Buckets (uint64 array)
func (h *Histogram) ToBytes() []byte {
	buf := new(bytes.Buffer)
	_ = binary.Write(buf, binary.LittleEndian, uint32(BinaryHeader))
	_ = binary.Write(buf, binary.LittleEndian, h.Count)
	_ = binary.Write(buf, binary.LittleEndian, math.Float64bits(h.Sum))
	_ = binary.Write(buf, binary.LittleEndian, math.Float64bits(h.Min))
	_ = binary.Write(buf, binary.LittleEndian, math.Float64bits(h.Max))

	for i := 0; i < NumBuckets; i++ {
		_ = binary.Write(buf, binary.LittleEndian, h.Buckets[i])
	}
	return buf.Bytes()
}

// FromBytes deserializes a histogram from either binary representation or JSON fallback.
func FromBytes(data []byte) (*Histogram, error) {
	if len(data) == 0 {
		return NewHistogram(), nil
	}

	// Check if data is binary format (548 bytes)
	if len(data) == 548 {
		var magic uint32
		r := bytes.NewReader(data)
		if err := binary.Read(r, binary.LittleEndian, &magic); err == nil && magic == BinaryHeader {
			h := &Histogram{}
			var sumBits, minBits, maxBits uint64
			if err := binary.Read(r, binary.LittleEndian, &h.Count); err != nil {
				return nil, err
			}
			if err := binary.Read(r, binary.LittleEndian, &sumBits); err != nil {
				return nil, err
			}
			if err := binary.Read(r, binary.LittleEndian, &minBits); err != nil {
				return nil, err
			}
			if err := binary.Read(r, binary.LittleEndian, &maxBits); err != nil {
				return nil, err
			}
			h.Sum = math.Float64frombits(sumBits)
			h.Min = math.Float64frombits(minBits)
			h.Max = math.Float64frombits(maxBits)

			for i := 0; i < NumBuckets; i++ {
				if err := binary.Read(r, binary.LittleEndian, &h.Buckets[i]); err != nil {
					return nil, err
				}
			}
			return h, nil
		}
	}

	// Fallback to JSON deserialization
	var h Histogram
	if err := json.Unmarshal(data, &h); err != nil {
		return nil, errors.New("invalid histogram byte format")
	}
	return &h, nil
}
