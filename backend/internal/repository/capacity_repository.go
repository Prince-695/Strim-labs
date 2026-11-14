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
	"gorm.io/gorm/clause"
)

// CapacityRepository manages persistence and retrieval of capacity analysis reports.
type CapacityRepository interface {
	Save(ctx context.Context, report *domain.CapacityReport) error
	FindByLoadTestID(ctx context.Context, loadTestID string) (*domain.CapacityReport, error)
	FindByProjectID(ctx context.Context, projectID string) ([]*domain.CapacityReport, error)
	DeleteByLoadTestID(ctx context.Context, loadTestID string) error
}

// GormCapacityRepository implements CapacityRepository using GORM / PostgreSQL.
type GormCapacityRepository struct {
	db *database.DB
}

// NewCapacityRepository creates a new GormCapacityRepository.
func NewCapacityRepository(db *database.DB) *GormCapacityRepository {
	return &GormCapacityRepository{db: db}
}

// Save inserts or updates a capacity report, keyed by load_test_id.
func (r *GormCapacityRepository) Save(ctx context.Context, report *domain.CapacityReport) error {
	if r == nil || r.db == nil || r.db.DB == nil {
		return errors.New("database not available")
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "load_test_id"}},
		UpdateAll: true,
	}).Create(report).Error
}

// FindByLoadTestID retrieves the capacity report for a given load test.
func (r *GormCapacityRepository) FindByLoadTestID(ctx context.Context, loadTestID string) (*domain.CapacityReport, error) {
	if r == nil || r.db == nil || r.db.DB == nil {
		return nil, errors.New("database not available")
	}
	var report domain.CapacityReport
	err := r.db.WithContext(ctx).Where("load_test_id = ?", loadTestID).First(&report).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &report, nil
}

// FindByProjectID lists all capacity reports for a project ordered by creation time descending.
func (r *GormCapacityRepository) FindByProjectID(ctx context.Context, projectID string) ([]*domain.CapacityReport, error) {
	if r == nil || r.db == nil || r.db.DB == nil {
		return nil, errors.New("database not available")
	}
	var reports []*domain.CapacityReport
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		Find(&reports).Error
	if err != nil {
		return nil, err
	}
	return reports, nil
}

// DeleteByLoadTestID removes the capacity report for a load test.
func (r *GormCapacityRepository) DeleteByLoadTestID(ctx context.Context, loadTestID string) error {
	if r == nil || r.db == nil || r.db.DB == nil {
		return errors.New("database not available")
	}
	return r.db.WithContext(ctx).
		Where("load_test_id = ?", loadTestID).
		Delete(&domain.CapacityReport{}).Error
}

// InMemoryCapacityRepository provides a thread-safe in-memory store for testing.
type InMemoryCapacityRepository struct {
	mu      sync.RWMutex
	reports map[string]*domain.CapacityReport // key: load_test_id
}

// NewInMemoryCapacityRepository creates an in-memory repository instance.
func NewInMemoryCapacityRepository() *InMemoryCapacityRepository {
	return &InMemoryCapacityRepository{
		reports: make(map[string]*domain.CapacityReport),
	}
}

// Save stores or updates a capacity report copy in memory.
func (r *InMemoryCapacityRepository) Save(_ context.Context, report *domain.CapacityReport) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	cp := *report
	if cp.CreatedAt.IsZero() {
		cp.CreatedAt = time.Now().UTC()
	}
	cp.UpdatedAt = time.Now().UTC()

	// Deep copy windows to prevent external mutation
	if report.Windows != nil {
		cp.Windows = make([]domain.CapacityWindow, len(report.Windows))
		copy(cp.Windows, report.Windows)
	}

	r.reports[cp.LoadTestID] = &cp
	return nil
}

// FindByLoadTestID retrieves a defensive copy of the capacity report by load test ID.
func (r *InMemoryCapacityRepository) FindByLoadTestID(_ context.Context, loadTestID string) (*domain.CapacityReport, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	report, exists := r.reports[loadTestID]
	if !exists {
		return nil, nil
	}

	cp := *report
	if report.Windows != nil {
		cp.Windows = make([]domain.CapacityWindow, len(report.Windows))
		copy(cp.Windows, report.Windows)
	}
	return &cp, nil
}

// FindByProjectID returns all capacity reports for a project ordered descending.
func (r *InMemoryCapacityRepository) FindByProjectID(_ context.Context, projectID string) ([]*domain.CapacityReport, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []*domain.CapacityReport
	for _, report := range r.reports {
		if report.ProjectID == projectID {
			cp := *report
			if report.Windows != nil {
				cp.Windows = make([]domain.CapacityWindow, len(report.Windows))
				copy(cp.Windows, report.Windows)
			}
			result = append(result, &cp)
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	return result, nil
}

// DeleteByLoadTestID deletes a capacity report from memory.
func (r *InMemoryCapacityRepository) DeleteByLoadTestID(_ context.Context, loadTestID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.reports, loadTestID)
	return nil
}
