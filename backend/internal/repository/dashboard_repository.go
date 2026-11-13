package repository

import (
	"context"
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"gorm.io/gorm"
)

// DashboardRepository defines data persistence operations for dashboards.
type DashboardRepository interface {
	Create(ctx context.Context, dashboard *domain.Dashboard) error
	FindByID(ctx context.Context, projectID, dashboardID string) (*domain.Dashboard, error)
	FindDefaultByProject(ctx context.Context, projectID string) (*domain.Dashboard, error)
	ListByProject(ctx context.Context, projectID string) ([]*domain.Dashboard, error)
	Update(ctx context.Context, dashboard *domain.Dashboard, expectedVersion int) error
	Delete(ctx context.Context, projectID, dashboardID string) error
}

// --- GORM Implementation ---

type GormDashboardRepository struct {
	db *database.DB
}

func NewDashboardRepository(db *database.DB) *GormDashboardRepository {
	return &GormDashboardRepository{db: db}
}

func (r *GormDashboardRepository) Create(ctx context.Context, dashboard *domain.Dashboard) error {
	return r.db.WithContext(ctx).Create(dashboard).Error
}

func (r *GormDashboardRepository) FindByID(ctx context.Context, projectID, dashboardID string) (*domain.Dashboard, error) {
	var d domain.Dashboard
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", dashboardID, projectID).
		First(&d).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.NewDashboardNotFoundError()
		}
		return nil, domain.NewInternalError(err)
	}
	return &d, nil
}

func (r *GormDashboardRepository) FindDefaultByProject(ctx context.Context, projectID string) (*domain.Dashboard, error) {
	var d domain.Dashboard
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND is_default = ?", projectID, true).
		First(&d).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Not found is not an error when checking if seeded
		}
		return nil, domain.NewInternalError(err)
	}
	return &d, nil
}

func (r *GormDashboardRepository) ListByProject(ctx context.Context, projectID string) ([]*domain.Dashboard, error) {
	var dashboards []*domain.Dashboard
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("is_default desc, created_at asc").
		Find(&dashboards).Error
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return dashboards, nil
}

func (r *GormDashboardRepository) Update(ctx context.Context, dashboard *domain.Dashboard, expectedVersion int) error {
	now := time.Now()
	nextVersion := expectedVersion + 1

	res := r.db.WithContext(ctx).
		Model(&domain.Dashboard{}).
		Where("id = ? AND project_id = ? AND version = ?", dashboard.ID, dashboard.ProjectID, expectedVersion).
		Updates(map[string]interface{}{
			"name":            dashboard.Name,
			"time_range":      dashboard.TimeRange,
			"refresh_seconds": dashboard.RefreshSeconds,
			"widgets":         dashboard.Widgets,
			"version":         nextVersion,
			"updated_at":      now,
		})
	if res.Error != nil {
		return domain.NewInternalError(res.Error)
	}
	if res.RowsAffected == 0 {
		// Check if record exists to distinguish 404 from 409
		var count int64
		_ = r.db.WithContext(ctx).Model(&domain.Dashboard{}).
			Where("id = ? AND project_id = ?", dashboard.ID, dashboard.ProjectID).
			Count(&count)
		if count == 0 {
			return domain.NewDashboardNotFoundError()
		}
		return domain.NewVersionConflictError()
	}

	dashboard.Version = nextVersion
	dashboard.UpdatedAt = now
	return nil
}

func (r *GormDashboardRepository) Delete(ctx context.Context, projectID, dashboardID string) error {
	existing, err := r.FindByID(ctx, projectID, dashboardID)
	if err != nil {
		return err
	}
	if existing.IsDefault {
		return domain.NewDefaultDashboardUndeletableError()
	}

	res := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", dashboardID, projectID).
		Delete(&domain.Dashboard{})
	if res.Error != nil {
		return domain.NewInternalError(res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.NewDashboardNotFoundError()
	}
	return nil
}

// --- In-Memory Implementation for fast testing ---

type InMemoryDashboardRepository struct {
	mu         sync.RWMutex
	dashboards map[string]*domain.Dashboard
}

func NewInMemoryDashboardRepository() *InMemoryDashboardRepository {
	return &InMemoryDashboardRepository{
		dashboards: make(map[string]*domain.Dashboard),
	}
}

func (r *InMemoryDashboardRepository) Create(ctx context.Context, dashboard *domain.Dashboard) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	cpy := *dashboard
	r.dashboards[dashboard.ID] = &cpy
	return nil
}

func (r *InMemoryDashboardRepository) FindByID(ctx context.Context, projectID, dashboardID string) (*domain.Dashboard, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	d, ok := r.dashboards[dashboardID]
	if !ok || d.ProjectID != projectID {
		return nil, domain.NewDashboardNotFoundError()
	}
	cpy := *d
	return &cpy, nil
}

func (r *InMemoryDashboardRepository) FindDefaultByProject(ctx context.Context, projectID string) (*domain.Dashboard, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, d := range r.dashboards {
		if d.ProjectID == projectID && d.IsDefault {
			cpy := *d
			return &cpy, nil
		}
	}
	return nil, nil
}

func (r *InMemoryDashboardRepository) ListByProject(ctx context.Context, projectID string) ([]*domain.Dashboard, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*domain.Dashboard
	for _, d := range r.dashboards {
		if d.ProjectID == projectID {
			cpy := *d
			list = append(list, &cpy)
		}
	}

	sort.Slice(list, func(i, j int) bool {
		if list[i].IsDefault != list[j].IsDefault {
			return list[i].IsDefault
		}
		return list[i].CreatedAt.Before(list[j].CreatedAt)
	})

	return list, nil
}

func (r *InMemoryDashboardRepository) Update(ctx context.Context, dashboard *domain.Dashboard, expectedVersion int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	d, ok := r.dashboards[dashboard.ID]
	if !ok || d.ProjectID != dashboard.ProjectID {
		return domain.NewDashboardNotFoundError()
	}

	if d.Version != expectedVersion {
		return domain.NewVersionConflictError()
	}

	d.Name = dashboard.Name
	d.TimeRange = dashboard.TimeRange
	d.RefreshSeconds = dashboard.RefreshSeconds
	d.Widgets = dashboard.Widgets
	d.Version = expectedVersion + 1
	d.UpdatedAt = time.Now()

	dashboard.Version = d.Version
	dashboard.UpdatedAt = d.UpdatedAt
	return nil
}

func (r *InMemoryDashboardRepository) Delete(ctx context.Context, projectID, dashboardID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	d, ok := r.dashboards[dashboardID]
	if !ok || d.ProjectID != projectID {
		return domain.NewDashboardNotFoundError()
	}
	if d.IsDefault {
		return domain.NewDefaultDashboardUndeletableError()
	}

	delete(r.dashboards, dashboardID)
	return nil
}
