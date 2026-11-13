package domain

import (
	"strings"
	"time"
)

// ValidateWidgets checks that all widgets adhere to schema constraints.
func ValidateWidgets(widgets []Widget) *AppError {
	if len(widgets) == 0 {
		return NewValidationError("widgets", "Dashboard must contain at least 1 widget")
	}
	if len(widgets) > 30 {
		return NewTooManyWidgetsError()
	}

	for i, w := range widgets {
		if strings.TrimSpace(w.Title) == "" {
			return NewValidationError("widgets", "Widget title cannot be empty")
		}
		if !ValidWidgetTypes[w.Type] {
			return NewValidationError("widgets", "Unsupported widget type: "+string(w.Type))
		}
		metric := strings.ToLower(strings.TrimSpace(w.Query.Metric))
		if metric == "" || !ValidQueryMetrics[metric] {
			return NewValidationError("widgets", "Invalid or disallowed query metric: "+w.Query.Metric)
		}
		groupBy := strings.ToLower(strings.TrimSpace(w.Query.GroupBy))
		if !ValidGroupBys[groupBy] {
			return NewValidationError("widgets", "Invalid group_by dimension: "+w.Query.GroupBy)
		}
		if w.Layout.W <= 0 || w.Layout.H <= 0 {
			widgets[i].Layout.W = 6
			widgets[i].Layout.H = 4
		}
	}
	return nil
}

// CreateDashboardRequest defines payload to create a new dashboard.
type CreateDashboardRequest struct {
	Name           string   `json:"name" validate:"required,min=2,max=128"`
	TimeRange      string   `json:"time_range,omitempty"`
	RefreshSeconds int      `json:"refresh_seconds,omitempty"`
	Widgets        []Widget `json:"widgets" validate:"required,min=1,max=30"`
}

// Validate validates dashboard creation parameters.
func (r *CreateDashboardRequest) Validate() *AppError {
	r.Name = strings.TrimSpace(r.Name)
	if len(r.Name) < 2 || len(r.Name) > 128 {
		return NewValidationError("name", "Dashboard name must be between 2 and 128 characters")
	}
	if r.TimeRange == "" {
		r.TimeRange = "1h"
	}
	if r.RefreshSeconds <= 0 {
		r.RefreshSeconds = 15
	}
	return ValidateWidgets(r.Widgets)
}

// UpdateDashboardRequest defines parameters to modify an existing dashboard with optimistic locking.
type UpdateDashboardRequest struct {
	Version        int       `json:"version" validate:"required,min=1"`
	Name           *string   `json:"name,omitempty"`
	TimeRange      *string   `json:"time_range,omitempty"`
	RefreshSeconds *int      `json:"refresh_seconds,omitempty"`
	Widgets        *[]Widget `json:"widgets,omitempty"`
}

// Validate validates update parameters.
func (r *UpdateDashboardRequest) Validate() *AppError {
	if r.Version < 1 {
		return NewValidationError("version", "A valid resource version (>= 1) is required for optimistic concurrency control")
	}
	if r.Name != nil {
		trimmed := strings.TrimSpace(*r.Name)
		if len(trimmed) < 2 || len(trimmed) > 128 {
			return NewValidationError("name", "Dashboard name must be between 2 and 128 characters")
		}
		*r.Name = trimmed
	}
	if r.Widgets != nil {
		if appErr := ValidateWidgets(*r.Widgets); appErr != nil {
			return appErr
		}
	}
	return nil
}

// CloneDashboardRequest defines optional custom name when cloning a dashboard.
type CloneDashboardRequest struct {
	Name string `json:"name,omitempty"`
}

// DashboardListItemResponse represents concise summary item for dashboard listings.
type DashboardListItemResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	IsDefault bool      `json:"is_default"`
	Version   int       `json:"version"`
	UpdatedAt time.Time `json:"updated_at"`
}

// DashboardResponse represents the full dashboard details including deserialized widgets.
type DashboardResponse struct {
	ID             string    `json:"id"`
	ProjectID      string    `json:"project_id"`
	Name           string    `json:"name"`
	IsDefault      bool      `json:"is_default"`
	Version        int       `json:"version"`
	TimeRange      string    `json:"time_range"`
	RefreshSeconds int       `json:"refresh_seconds"`
	Widgets        []Widget  `json:"widgets"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// ToDashboardResponse converts Dashboard model into detailed response DTO.
func ToDashboardResponse(d *Dashboard) (DashboardResponse, error) {
	widgets, err := d.GetWidgets()
	if err != nil {
		return DashboardResponse{}, err
	}

	return DashboardResponse{
		ID:             d.ID,
		ProjectID:      d.ProjectID,
		Name:           d.Name,
		IsDefault:      d.IsDefault,
		Version:        d.Version,
		TimeRange:      d.TimeRange,
		RefreshSeconds: d.RefreshSeconds,
		Widgets:        widgets,
		CreatedAt:      d.CreatedAt,
		UpdatedAt:      d.UpdatedAt,
	}, nil
}

// ToDashboardListItemResponse converts Dashboard model into list summary item.
func ToDashboardListItemResponse(d *Dashboard) DashboardListItemResponse {
	return DashboardListItemResponse{
		ID:        d.ID,
		Name:      d.Name,
		IsDefault: d.IsDefault,
		Version:   d.Version,
		UpdatedAt: d.UpdatedAt,
	}
}
