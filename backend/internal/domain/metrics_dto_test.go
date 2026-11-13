package domain_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTimeseriesPoint_MarshalUnmarshal(t *testing.T) {
	ts := time.Date(2026, 11, 13, 12, 0, 0, 0, time.UTC)
	val := 42.5

	p1 := domain.TimeseriesPoint{
		Timestamp: ts,
		Value:     &val,
	}

	data1, err := json.Marshal(p1)
	require.NoError(t, err)
	assert.Equal(t, `["2026-11-13T12:00:00Z",42.5]`, string(data1))

	var restored1 domain.TimeseriesPoint
	err = json.Unmarshal(data1, &restored1)
	require.NoError(t, err)
	assert.Equal(t, ts, restored1.Timestamp)
	require.NotNil(t, restored1.Value)
	assert.Equal(t, 42.5, *restored1.Value)

	// Test null value
	p2 := domain.TimeseriesPoint{
		Timestamp: ts,
		Value:     nil,
	}

	data2, err := json.Marshal(p2)
	require.NoError(t, err)
	assert.Equal(t, `["2026-11-13T12:00:00Z",null]`, string(data2))

	var restored2 domain.TimeseriesPoint
	err = json.Unmarshal(data2, &restored2)
	require.NoError(t, err)
	assert.Equal(t, ts, restored2.Timestamp)
	assert.Nil(t, restored2.Value)
}
