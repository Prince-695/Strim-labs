package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/audit"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// DashboardService coordinates dashboard lifecycle, validation, seeding, and cloning.
type DashboardService interface {
	CreateDashboard(ctx context.Context, orgID, projectID string, req domain.CreateDashboardRequest) (*domain.DashboardResponse, error)
	GetDashboard(ctx context.Context, orgID, projectID, dashboardID string) (*domain.DashboardResponse, error)
	ListDashboards(ctx context.Context, orgID, projectID string) ([]domain.DashboardListItemResponse, error)
	UpdateDashboard(ctx context.Context, orgID, projectID, dashboardID string, req domain.UpdateDashboardRequest) (*domain.DashboardResponse, error)
	DeleteDashboard(ctx context.Context, orgID, projectID, dashboardID string) error
	CloneDashboard(ctx context.Context, orgID, projectID, dashboardID string, req domain.CloneDashboardRequest) (*domain.DashboardResponse, error)
	SeedDefaultDashboard(ctx context.Context, orgID, projectID string) (*domain.DashboardResponse, error)
}

type dashboardService struct {
	dashboardRepo repository.DashboardRepository
	projectRepo   repository.ProjectRepository
	auditRec      audit.Recorder
	idGen         ids.IDGenerator
}

// NewDashboardService creates a new DashboardService instance.
func NewDashboardService(
	dashboardRepo repository.DashboardRepository,
	projectRepo repository.ProjectRepository,
	auditRec audit.Recorder,
) DashboardService {
	return &dashboardService{
		dashboardRepo: dashboardRepo,
		projectRepo:   projectRepo,
		auditRec:      auditRec,
		idGen:         ids.NewUUIDv7Generator(),
	}
}

// CreateDashboard validates widget constraints and persists a new custom dashboard.
func (s *dashboardService) CreateDashboard(ctx context.Context, orgID, projectID string, req domain.CreateDashboardRequest) (*domain.DashboardResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	if appErr := req.Validate(); appErr != nil {
		return nil, appErr
	}

	for i := range req.Widgets {
		if req.Widgets[i].ID == "" {
			req.Widgets[i].ID = s.idGen.MustNewUUIDv7()
		}
	}

	now := time.Now().UTC()
	dash := &domain.Dashboard{
		ID:             s.idGen.MustNewUUIDv7(),
		ProjectID:      projectID,
		OrgID:          orgID,
		Name:           req.Name,
		IsDefault:      false,
		Version:        1,
		TimeRange:      req.TimeRange,
		RefreshSeconds: req.RefreshSeconds,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := dash.SetWidgets(req.Widgets); err != nil {
		return nil, domain.NewInternalError(err)
	}

	if err := s.dashboardRepo.Create(ctx, dash); err != nil {
		return nil, err
	}

	if s.auditRec != nil {
		s.auditRec.RecordFromContext(ctx, orgID, "dashboard.created", "dashboard", dash.ID, nil, map[string]interface{}{
			"name":         dash.Name,
			"is_default":   dash.IsDefault,
			"widget_count": len(req.Widgets),
		})
	}

	resp, err := domain.ToDashboardResponse(dash)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return &resp, nil
}

// GetDashboard retrieves a dashboard with its deserialized widgets.
func (s *dashboardService) GetDashboard(ctx context.Context, orgID, projectID, dashboardID string) (*domain.DashboardResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	dash, err := s.dashboardRepo.FindByID(ctx, projectID, dashboardID)
	if err != nil {
		return nil, err
	}

	resp, err := domain.ToDashboardResponse(dash)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return &resp, nil
}

// ListDashboards lists all dashboards for a project, auto-seeding default if empty.
func (s *dashboardService) ListDashboards(ctx context.Context, orgID, projectID string) ([]domain.DashboardListItemResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	dashboards, err := s.dashboardRepo.ListByProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	if len(dashboards) == 0 {
		seeded, seedErr := s.seedDefaultDashboardModel(ctx, orgID, projectID)
		if seedErr == nil && seeded != nil {
			dashboards = []*domain.Dashboard{seeded}
		}
	}

	resp := make([]domain.DashboardListItemResponse, 0, len(dashboards))
	for _, d := range dashboards {
		resp = append(resp, domain.ToDashboardListItemResponse(d))
	}
	return resp, nil
}

// UpdateDashboard updates a dashboard enforcing optimistic version checking.
func (s *dashboardService) UpdateDashboard(ctx context.Context, orgID, projectID, dashboardID string, req domain.UpdateDashboardRequest) (*domain.DashboardResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	if appErr := req.Validate(); appErr != nil {
		return nil, appErr
	}

	dash, err := s.dashboardRepo.FindByID(ctx, projectID, dashboardID)
	if err != nil {
		return nil, err
	}

	prevWidgets, _ := dash.GetWidgets()
	prevData := map[string]interface{}{
		"name":         dash.Name,
		"time_range":   dash.TimeRange,
		"version":      dash.Version,
		"widget_count": len(prevWidgets),
	}

	if req.Name != nil {
		dash.Name = *req.Name
	}
	if req.TimeRange != nil {
		dash.TimeRange = *req.TimeRange
	}
	if req.RefreshSeconds != nil {
		dash.RefreshSeconds = *req.RefreshSeconds
	}
	if req.Widgets != nil {
		widgets := *req.Widgets
		for i := range widgets {
			if widgets[i].ID == "" {
				widgets[i].ID = s.idGen.MustNewUUIDv7()
			}
		}
		if err := dash.SetWidgets(widgets); err != nil {
			return nil, domain.NewInternalError(err)
		}
	}

	dash.UpdatedAt = time.Now().UTC()

	if err := s.dashboardRepo.Update(ctx, dash, req.Version); err != nil {
		return nil, err
	}

	if s.auditRec != nil {
		newWidgets, _ := dash.GetWidgets()
		s.auditRec.RecordFromContext(ctx, orgID, "dashboard.updated", "dashboard", dash.ID, prevData, map[string]interface{}{
			"name":         dash.Name,
			"time_range":   dash.TimeRange,
			"version":      dash.Version,
			"widget_count": len(newWidgets),
		})
	}

	resp, err := domain.ToDashboardResponse(dash)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return &resp, nil
}

// DeleteDashboard removes a dashboard, disallowing deletion of the default dashboard.
func (s *dashboardService) DeleteDashboard(ctx context.Context, orgID, projectID, dashboardID string) error {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return err
	}

	dash, err := s.dashboardRepo.FindByID(ctx, projectID, dashboardID)
	if err != nil {
		return err
	}

	if dash.IsDefault {
		return domain.NewDefaultDashboardUndeletableError()
	}

	if err := s.dashboardRepo.Delete(ctx, projectID, dashboardID); err != nil {
		return err
	}

	if s.auditRec != nil {
		s.auditRec.RecordFromContext(ctx, orgID, "dashboard.deleted", "dashboard", dashboardID, map[string]interface{}{
			"name": dash.Name,
		}, nil)
	}

	return nil
}

// CloneDashboard creates a new editable copy of an existing dashboard with fresh widget IDs.
func (s *dashboardService) CloneDashboard(ctx context.Context, orgID, projectID, dashboardID string, req domain.CloneDashboardRequest) (*domain.DashboardResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	source, err := s.dashboardRepo.FindByID(ctx, projectID, dashboardID)
	if err != nil {
		return nil, err
	}

	cloneName := strings.TrimSpace(req.Name)
	if cloneName == "" {
		cloneName = fmt.Sprintf("%s (copy)", source.Name)
	}
	if len(cloneName) > 128 {
		cloneName = cloneName[:128]
	}

	sourceWidgets, err := source.GetWidgets()
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	clonedWidgets := make([]domain.Widget, len(sourceWidgets))
	for i, w := range sourceWidgets {
		clonedWidgets[i] = w
		clonedWidgets[i].ID = s.idGen.MustNewUUIDv7()
	}

	now := time.Now().UTC()
	cloned := &domain.Dashboard{
		ID:             s.idGen.MustNewUUIDv7(),
		ProjectID:      projectID,
		OrgID:          orgID,
		Name:           cloneName,
		IsDefault:      false,
		Version:        1,
		TimeRange:      source.TimeRange,
		RefreshSeconds: source.RefreshSeconds,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := cloned.SetWidgets(clonedWidgets); err != nil {
		return nil, domain.NewInternalError(err)
	}

	if err := s.dashboardRepo.Create(ctx, cloned); err != nil {
		return nil, err
	}

	if s.auditRec != nil {
		s.auditRec.RecordFromContext(ctx, orgID, "dashboard.cloned", "dashboard", cloned.ID, nil, map[string]interface{}{
			"source_id":    source.ID,
			"name":         cloned.Name,
			"widget_count": len(clonedWidgets),
		})
	}

	resp, err := domain.ToDashboardResponse(cloned)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return &resp, nil
}

// SeedDefaultDashboard seeds the standard "API Overview" dashboard for a project if not already present.
func (s *dashboardService) SeedDefaultDashboard(ctx context.Context, orgID, projectID string) (*domain.DashboardResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	d, err := s.seedDefaultDashboardModel(ctx, orgID, projectID)
	if err != nil {
		return nil, err
	}

	resp, err := domain.ToDashboardResponse(d)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return &resp, nil
}

func (s *dashboardService) seedDefaultDashboardModel(ctx context.Context, orgID, projectID string) (*domain.Dashboard, error) {
	existing, err := s.dashboardRepo.FindDefaultByProject(ctx, projectID)
	if err == nil && existing != nil {
		return existing, nil
	}

	defaultWidgets := []domain.Widget{
		{
			ID:    s.idGen.MustNewUUIDv7(),
			Type:  domain.WidgetTypeTimeseries,
			Title: "Overall P95 Latency",
			Layout: domain.WidgetLayout{
				X: 0,
				Y: 0,
				W: 6,
				H: 4,
			},
			Query: domain.WidgetQuery{
				Metric:  "p95",
				GroupBy: "endpoint",
			},
			Options: domain.WidgetOptions{
				Unit:    "ms",
				Stacked: false,
			},
		},
		{
			ID:    s.idGen.MustNewUUIDv7(),
			Type:  domain.WidgetTypeTimeseries,
			Title: "Request Throughput",
			Layout: domain.WidgetLayout{
				X: 6,
				Y: 0,
				W: 6,
				H: 4,
			},
			Query: domain.WidgetQuery{
				Metric:  "rps",
				GroupBy: "none",
			},
			Options: domain.WidgetOptions{
				Unit:    "rps",
				Stacked: false,
			},
		},
		{
			ID:    s.idGen.MustNewUUIDv7(),
			Type:  domain.WidgetTypeStatusPie,
			Title: "Status Codes Breakdown",
			Layout: domain.WidgetLayout{
				X: 0,
				Y: 4,
				W: 6,
				H: 4,
			},
			Query: domain.WidgetQuery{
				Metric:  "status_codes",
				GroupBy: "status",
			},
			Options: domain.WidgetOptions{
				Unit: "count",
			},
		},
		{
			ID:    s.idGen.MustNewUUIDv7(),
			Type:  domain.WidgetTypeTable,
			Title: "Top Endpoints Summary",
			Layout: domain.WidgetLayout{
				X: 6,
				Y: 4,
				W: 6,
				H: 4,
			},
			Query: domain.WidgetQuery{
				Metric:  "requests",
				GroupBy: "endpoint",
			},
			Options: domain.WidgetOptions{
				Unit: "count",
			},
		},
	}

	now := time.Now().UTC()
	dash := &domain.Dashboard{
		ID:             s.idGen.MustNewUUIDv7(),
		ProjectID:      projectID,
		OrgID:          orgID,
		Name:           "API Overview",
		IsDefault:      true,
		Version:        1,
		TimeRange:      "1h",
		RefreshSeconds: 15,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := dash.SetWidgets(defaultWidgets); err != nil {
		return nil, domain.NewInternalError(err)
	}

	if err := s.dashboardRepo.Create(ctx, dash); err != nil {
		return nil, err
	}

	if s.auditRec != nil {
		s.auditRec.RecordFromContext(ctx, orgID, "dashboard.created", "dashboard", dash.ID, nil, map[string]interface{}{
			"name":         dash.Name,
			"is_default":   true,
			"widget_count": len(defaultWidgets),
		})
	}

	return dash, nil
}
