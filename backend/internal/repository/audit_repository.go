package repository

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
)

// AuditLogRepository defines persistence operations for immutable audit trail entries.
type AuditLogRepository interface {
	Append(ctx context.Context, log *domain.AuditLog) error
	List(ctx context.Context, filter domain.AuditLogFilter) ([]*domain.AuditLog, error)
}

// --- GORM Implementation ---

type GormAuditLogRepository struct {
	db *database.DB
}

func NewAuditLogRepository(db *database.DB) *GormAuditLogRepository {
	return &GormAuditLogRepository{db: db}
}

func (r *GormAuditLogRepository) Append(ctx context.Context, log *domain.AuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *GormAuditLogRepository) List(ctx context.Context, filter domain.AuditLogFilter) ([]*domain.AuditLog, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	query := r.db.WithContext(ctx).Where("org_id = ?", filter.OrgID)

	if filter.ActorID != "" {
		query = query.Where("actor_id = ?", filter.ActorID)
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.ResourceType != "" {
		query = query.Where("resource_type = ?", filter.ResourceType)
	}
	if filter.From != nil {
		query = query.Where("at >= ?", *filter.From)
	}
	if filter.To != nil {
		query = query.Where("at <= ?", *filter.To)
	}
	if filter.Cursor != "" {
		cursorTime, err := time.Parse(time.RFC3339Nano, filter.Cursor)
		if err == nil {
			query = query.Where("at < ?", cursorTime)
		}
	}

	var logs []*domain.AuditLog
	err := query.Order("at desc").Limit(limit).Find(&logs).Error
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return logs, nil
}

// --- In-Memory Implementation for fast testing ---

type InMemoryAuditLogRepository struct {
	mu   sync.RWMutex
	logs []*domain.AuditLog
}

func NewInMemoryAuditLogRepository() *InMemoryAuditLogRepository {
	return &InMemoryAuditLogRepository{
		logs: make([]*domain.AuditLog, 0),
	}
}

func (r *InMemoryAuditLogRepository) Append(ctx context.Context, log *domain.AuditLog) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	cpy := *log
	r.logs = append(r.logs, &cpy)
	return nil
}

func (r *InMemoryAuditLogRepository) List(ctx context.Context, filter domain.AuditLogFilter) ([]*domain.AuditLog, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	limit := filter.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	var cursorTime *time.Time
	if filter.Cursor != "" {
		t, err := time.Parse(time.RFC3339Nano, filter.Cursor)
		if err == nil {
			cursorTime = &t
		}
	}

	var filtered []*domain.AuditLog
	for _, l := range r.logs {
		if l.OrgID != filter.OrgID {
			continue
		}
		if filter.ActorID != "" && l.ActorID != filter.ActorID {
			continue
		}
		if filter.Action != "" && l.Action != filter.Action {
			continue
		}
		if filter.ResourceType != "" && l.ResourceType != filter.ResourceType {
			continue
		}
		if filter.From != nil && l.At.Before(*filter.From) {
			continue
		}
		if filter.To != nil && l.At.After(*filter.To) {
			continue
		}
		if cursorTime != nil && !l.At.Before(*cursorTime) {
			continue
		}
		cpy := *l
		filtered = append(filtered, &cpy)
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].At.After(filtered[j].At)
	})

	if len(filtered) > limit {
		filtered = filtered[:limit]
	}
	return filtered, nil
}
