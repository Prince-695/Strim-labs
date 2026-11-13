package ingest

import (
	"context"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TimeSeriesStore defines the persistence contract for raw telemetry events and rolled-up aggregations.
type TimeSeriesStore interface {
	WriteEvents(ctx context.Context, events []domain.RequestEvent) error
	QueryEvents(ctx context.Context, projectID string, start, end time.Time, limit int) ([]domain.RequestEvent, error)
	WriteRollups1m(ctx context.Context, rollups []domain.RequestRollup1m) error
	WriteRollups1h(ctx context.Context, rollups []domain.RequestRollup1h) error
	QueryRollups1m(ctx context.Context, projectID, endpointKey string, start, end time.Time) ([]domain.RequestRollup1m, error)
	QueryRollups1h(ctx context.Context, projectID, endpointKey string, start, end time.Time) ([]domain.RequestRollup1h, error)
	DropEventsOlderThan(ctx context.Context, cutoff time.Time) (int64, error)
}

// GormTimeSeriesStore implements TimeSeriesStore backed by GORM (PostgreSQL or SQLite).
type GormTimeSeriesStore struct {
	db *gorm.DB
}

// NewGormTimeSeriesStore initializes a GormTimeSeriesStore.
func NewGormTimeSeriesStore(db *gorm.DB) *GormTimeSeriesStore {
	return &GormTimeSeriesStore{db: db}
}

// WriteEvents batch inserts raw telemetry events in chunks of 500.
func (s *GormTimeSeriesStore) WriteEvents(ctx context.Context, events []domain.RequestEvent) error {
	if len(events) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).CreateInBatches(events, 500).Error
}

// QueryEvents retrieves raw telemetry events for a project within a time window.
func (s *GormTimeSeriesStore) QueryEvents(ctx context.Context, projectID string, start, end time.Time, limit int) ([]domain.RequestEvent, error) {
	if limit <= 0 || limit > 10000 {
		limit = 1000
	}

	var events []domain.RequestEvent
	query := s.db.WithContext(ctx)

	if projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	if !start.IsZero() {
		query = query.Where("timestamp >= ?", start)
	}
	if !end.IsZero() {
		query = query.Where("timestamp <= ?", end)
	}

	if err := query.Order("timestamp DESC").Limit(limit).Find(&events).Error; err != nil {
		return nil, err
	}
	return events, nil
}

// WriteRollups1m upserts 1-minute rollup records.
func (s *GormTimeSeriesStore) WriteRollups1m(ctx context.Context, rollups []domain.RequestRollup1m) error {
	if len(rollups) == 0 {
		return nil
	}

	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "project_id"}, {Name: "endpoint_key"}, {Name: "bucket"}},
		UpdateAll: true,
	}).CreateInBatches(rollups, 200).Error
}

// WriteRollups1h upserts 1-hour rollup records.
func (s *GormTimeSeriesStore) WriteRollups1h(ctx context.Context, rollups []domain.RequestRollup1h) error {
	if len(rollups) == 0 {
		return nil
	}

	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "project_id"}, {Name: "endpoint_key"}, {Name: "bucket"}},
		UpdateAll: true,
	}).CreateInBatches(rollups, 200).Error
}

// QueryRollups1m queries 1-minute aggregation buckets for an endpoint.
func (s *GormTimeSeriesStore) QueryRollups1m(ctx context.Context, projectID, endpointKey string, start, end time.Time) ([]domain.RequestRollup1m, error) {
	var results []domain.RequestRollup1m
	query := s.db.WithContext(ctx)

	if projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	if endpointKey != "" {
		query = query.Where("endpoint_key = ?", endpointKey)
	}
	if !start.IsZero() {
		query = query.Where("bucket >= ?", start)
	}
	if !end.IsZero() {
		query = query.Where("bucket <= ?", end)
	}

	if err := query.Order("bucket ASC").Find(&results).Error; err != nil {
		return nil, err
	}
	return results, nil
}

// QueryRollups1h queries 1-hour aggregation buckets for an endpoint.
func (s *GormTimeSeriesStore) QueryRollups1h(ctx context.Context, projectID, endpointKey string, start, end time.Time) ([]domain.RequestRollup1h, error) {
	var results []domain.RequestRollup1h
	query := s.db.WithContext(ctx)

	if projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	if endpointKey != "" {
		query = query.Where("endpoint_key = ?", endpointKey)
	}
	if !start.IsZero() {
		query = query.Where("bucket >= ?", start)
	}
	if !end.IsZero() {
		query = query.Where("bucket <= ?", end)
	}

	if err := query.Order("bucket ASC").Find(&results).Error; err != nil {
		return nil, err
	}
	return results, nil
}

// DropEventsOlderThan purges raw events older than the specified retention cutoff.
func (s *GormTimeSeriesStore) DropEventsOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	res := s.db.WithContext(ctx).Where("timestamp < ?", cutoff).Delete(&domain.RequestEvent{})
	return res.RowsAffected, res.Error
}
