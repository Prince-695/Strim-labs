package repository

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// UsageRepository defines persistence operations for organization resource counters.
type UsageRepository interface {
	IncrementCounters(ctx context.Context, orgID, date string, events, testMinutes, requests int64) error
	GetDailyUsage(ctx context.Context, orgID, fromDate, toDate string) ([]*domain.DailyUsageCounter, error)
	GetMonthlyTotals(ctx context.Context, orgID, monthPrefix string) (events, testMinutes, requests int64, err error)
}

// --- GORM Implementation ---

type GormUsageRepository struct {
	db *database.DB
}

func NewUsageRepository(db *database.DB) *GormUsageRepository {
	return &GormUsageRepository{db: db}
}

func (r *GormUsageRepository) IncrementCounters(ctx context.Context, orgID, date string, events, testMinutes, requests int64) error {
	now := time.Now()
	id := orgID + "_" + date

	counter := &domain.DailyUsageCounter{
		ID:                id,
		OrgID:             orgID,
		Date:              date,
		EventsIngested:    events,
		LoadTestMinutes:   testMinutes,
		RequestsGenerated: requests,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "org_id"}, {Name: "date"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"events_ingested":    gorm.Expr("daily_usage_counters.events_ingested + ?", events),
			"load_test_minutes":  gorm.Expr("daily_usage_counters.load_test_minutes + ?", testMinutes),
			"requests_generated": gorm.Expr("daily_usage_counters.requests_generated + ?", requests),
			"updated_at":         now,
		}),
	}).Create(counter).Error
}

func (r *GormUsageRepository) GetDailyUsage(ctx context.Context, orgID, fromDate, toDate string) ([]*domain.DailyUsageCounter, error) {
	var list []*domain.DailyUsageCounter
	err := r.db.WithContext(ctx).
		Where("org_id = ? AND date >= ? AND date <= ?", orgID, fromDate, toDate).
		Order("date asc").
		Find(&list).Error
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return list, nil
}

func (r *GormUsageRepository) GetMonthlyTotals(ctx context.Context, orgID, monthPrefix string) (events, testMinutes, requests int64, err error) {
	type Totals struct {
		Events   int64 `gorm:"column:total_events"`
		Minutes  int64 `gorm:"column:total_minutes"`
		Requests int64 `gorm:"column:total_requests"`
	}

	var totals Totals
	err = r.db.WithContext(ctx).
		Model(&domain.DailyUsageCounter{}).
		Select("COALESCE(SUM(events_ingested), 0) as total_events, COALESCE(SUM(load_test_minutes), 0) as total_minutes, COALESCE(SUM(requests_generated), 0) as total_requests").
		Where("org_id = ? AND date LIKE ?", orgID, monthPrefix+"%").
		Scan(&totals).Error
	if err != nil {
		return 0, 0, 0, domain.NewInternalError(err)
	}
	return totals.Events, totals.Minutes, totals.Requests, nil
}

// --- In-Memory Implementation for fast testing ---

type InMemoryUsageRepository struct {
	mu       sync.RWMutex
	counters map[string]*domain.DailyUsageCounter
}

func NewInMemoryUsageRepository() *InMemoryUsageRepository {
	return &InMemoryUsageRepository{
		counters: make(map[string]*domain.DailyUsageCounter),
	}
}

func (r *InMemoryUsageRepository) IncrementCounters(ctx context.Context, orgID, date string, events, testMinutes, requests int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	key := orgID + ":" + date
	counter, ok := r.counters[key]
	if !ok {
		now := time.Now()
		counter = &domain.DailyUsageCounter{
			ID:                orgID + "_" + date,
			OrgID:             orgID,
			Date:              date,
			EventsIngested:    events,
			LoadTestMinutes:   testMinutes,
			RequestsGenerated: requests,
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		r.counters[key] = counter
		return nil
	}

	counter.EventsIngested += events
	counter.LoadTestMinutes += testMinutes
	counter.RequestsGenerated += requests
	counter.UpdatedAt = time.Now()
	return nil
}

func (r *InMemoryUsageRepository) GetDailyUsage(ctx context.Context, orgID, fromDate, toDate string) ([]*domain.DailyUsageCounter, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*domain.DailyUsageCounter
	for _, c := range r.counters {
		if c.OrgID == orgID && c.Date >= fromDate && c.Date <= toDate {
			cpy := *c
			list = append(list, &cpy)
		}
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].Date < list[j].Date
	})

	return list, nil
}

func (r *InMemoryUsageRepository) GetMonthlyTotals(ctx context.Context, orgID, monthPrefix string) (events, testMinutes, requests int64, err error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, c := range r.counters {
		if c.OrgID == orgID && strings.HasPrefix(c.Date, monthPrefix) {
			events += c.EventsIngested
			testMinutes += c.LoadTestMinutes
			requests += c.RequestsGenerated
		}
	}
	return events, testMinutes, requests, nil
}
