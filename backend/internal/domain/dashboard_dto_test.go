package domain

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDashboard_GetSetWidgets(t *testing.T) {
	d := &Dashboard{
		ID:        "d-1",
		ProjectID: "proj-1",
		Name:      "API Overview",
		Version:   1,
	}

	widgets := []Widget{
		{
			ID:    "w1",
			Type:  WidgetTypeTimeseries,
			Title: "P95 Latency",
			Layout: WidgetLayout{
				X: 0, Y: 0, W: 6, H: 4,
			},
			Query: WidgetQuery{
				Metric:  "p95",
				GroupBy: "endpoint",
			},
			Options: WidgetOptions{
				Unit: "ms",
			},
		},
	}

	err := d.SetWidgets(widgets)
	require.NoError(t, err)
	assert.NotEmpty(t, d.Widgets)

	restored, err := d.GetWidgets()
	require.NoError(t, err)
	require.Len(t, restored, 1)
	assert.Equal(t, "w1", restored[0].ID)
	assert.Equal(t, WidgetTypeTimeseries, restored[0].Type)
	assert.Equal(t, "p95", restored[0].Query.Metric)
}

func TestValidateWidgets(t *testing.T) {
	// 1. Valid widgets
	valid := []Widget{
		{
			ID:    "w1",
			Type:  WidgetTypeTimeseries,
			Title: "RPS",
			Query: WidgetQuery{Metric: "rps"},
		},
	}
	assert.Nil(t, ValidateWidgets(valid))

	// 2. Empty title rejected
	invalidTitle := []Widget{
		{
			ID:    "w1",
			Type:  WidgetTypeTimeseries,
			Title: "",
			Query: WidgetQuery{Metric: "rps"},
		},
	}
	assert.NotNil(t, ValidateWidgets(invalidTitle))

	// 3. Unsupported widget type rejected
	invalidType := []Widget{
		{
			ID:    "w1",
			Type:  WidgetType("3d_cube"),
			Title: "Invalid",
			Query: WidgetQuery{Metric: "rps"},
		},
	}
	assert.NotNil(t, ValidateWidgets(invalidType))

	// 4. Disallowed raw SQL / invalid metric rejected
	invalidMetric := []Widget{
		{
			ID:    "w1",
			Type:  WidgetTypeTable,
			Title: "Hack",
			Query: WidgetQuery{Metric: "SELECT * FROM users"},
		},
	}
	assert.NotNil(t, ValidateWidgets(invalidMetric))

	// 5. Exceeding 30 widgets limit rejected
	tooMany := make([]Widget, 31)
	for i := 0; i < 31; i++ {
		tooMany[i] = Widget{
			ID:    fmt.Sprintf("w%d", i),
			Type:  WidgetTypeStat,
			Title: fmt.Sprintf("Stat %d", i),
			Query: WidgetQuery{Metric: "p95"},
		}
	}
	appErr := ValidateWidgets(tooMany)
	require.NotNil(t, appErr)
	assert.Equal(t, ErrCodeTooManyWidgets, appErr.ErrorCode)
}

func TestToDashboardResponse(t *testing.T) {
	d := &Dashboard{
		ID:             "d-1",
		ProjectID:      "proj-1",
		Name:           "Core Services",
		IsDefault:      true,
		Version:        3,
		TimeRange:      "24h",
		RefreshSeconds: 30,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	_ = d.SetWidgets([]Widget{
		{ID: "w1", Type: WidgetTypeStat, Title: "Error Rate", Query: WidgetQuery{Metric: "error_rate"}},
	})

	resp, err := ToDashboardResponse(d)
	require.NoError(t, err)
	assert.Equal(t, "d-1", resp.ID)
	assert.True(t, resp.IsDefault)
	assert.Equal(t, 3, resp.Version)
	assert.Len(t, resp.Widgets, 1)

	listResp := ToDashboardListItemResponse(d)
	assert.Equal(t, "d-1", listResp.ID)
	assert.Equal(t, "Core Services", listResp.Name)
	assert.True(t, listResp.IsDefault)
}
