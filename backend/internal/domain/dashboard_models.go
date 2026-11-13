package domain

import (
	"encoding/json"
	"time"
)

// WidgetType defines supported visualization rendering modes.
type WidgetType string

const (
	WidgetTypeTimeseries WidgetType = "timeseries"
	WidgetTypeStat       WidgetType = "stat"
	WidgetTypeTable      WidgetType = "table"
	WidgetTypeStatusPie  WidgetType = "status_pie"
	WidgetTypeHeatmap    WidgetType = "heatmap"
)

// ValidWidgetTypes maps allowed widget types.
var ValidWidgetTypes = map[WidgetType]bool{
	WidgetTypeTimeseries: true,
	WidgetTypeStat:       true,
	WidgetTypeTable:      true,
	WidgetTypeStatusPie:  true,
	WidgetTypeHeatmap:    true,
}

// ValidQueryMetrics maps allowed templated metrics (no raw SQL).
var ValidQueryMetrics = map[string]bool{
	"p50":          true,
	"p90":          true,
	"p95":          true,
	"p99":          true,
	"rps":          true,
	"error_rate":   true,
	"status_codes": true,
	"requests":     true,
	"latency":      true,
}

// ValidGroupBys maps allowed grouping dimensions.
var ValidGroupBys = map[string]bool{
	"endpoint": true,
	"status":   true,
	"none":     true,
	"":         true,
}

// WidgetLayout represents grid placement coordinates.
type WidgetLayout struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

// WidgetQuery specifies the templated query executed for the widget.
type WidgetQuery struct {
	Metric      string   `json:"metric"`
	GroupBy     string   `json:"group_by,omitempty"`
	EndpointIDs []string `json:"endpoint_ids,omitempty"`
}

// WidgetOptions defines presentation formatting options.
type WidgetOptions struct {
	Unit    string `json:"unit,omitempty"` // "ms", "rps", "%", "count"
	Stacked bool   `json:"stacked,omitempty"`
}

// Widget represents an individual visual element within a dashboard.
type Widget struct {
	ID      string        `json:"id"`
	Type    WidgetType    `json:"type"`
	Title   string        `json:"title"`
	Layout  WidgetLayout  `json:"layout"`
	Query   WidgetQuery   `json:"query"`
	Options WidgetOptions `json:"options"`
}

// Dashboard represents an interactive monitoring dashboard.
type Dashboard struct {
	ID             string    `gorm:"primaryKey;size:36" json:"id"`
	ProjectID      string    `gorm:"size:36;not null;index" json:"project_id"`
	OrgID          string    `gorm:"size:36;not null;index" json:"org_id"`
	Name           string    `gorm:"size:128;not null" json:"name"`
	IsDefault      bool      `gorm:"not null;default:false" json:"is_default"`
	Version        int       `gorm:"not null;default:1" json:"version"`
	TimeRange      string    `gorm:"size:20;not null;default:'1h'" json:"time_range"`
	RefreshSeconds int       `gorm:"not null;default:15" json:"refresh_seconds"`
	Widgets        string    `gorm:"type:text;not null" json:"-"` // JSON serialized []Widget
	CreatedAt      time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt      time.Time `gorm:"not null" json:"updated_at"`
}

// TableName returns GORM table name for Dashboard.
func (Dashboard) TableName() string {
	return "dashboards"
}

// GetWidgets unmarshals the internal JSON representation into []Widget.
func (d *Dashboard) GetWidgets() ([]Widget, error) {
	if d.Widgets == "" || d.Widgets == "[]" {
		return []Widget{}, nil
	}
	var widgets []Widget
	if err := json.Unmarshal([]byte(d.Widgets), &widgets); err != nil {
		return nil, err
	}
	return widgets, nil
}

// SetWidgets serializes []Widget into internal JSON storage.
func (d *Dashboard) SetWidgets(widgets []Widget) error {
	if widgets == nil {
		widgets = []Widget{}
	}
	bytes, err := json.Marshal(widgets)
	if err != nil {
		return err
	}
	d.Widgets = string(bytes)
	return nil
}
