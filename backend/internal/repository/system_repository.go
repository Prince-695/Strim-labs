package repository

import (
	"context"

	"github.com/Prince-695/strim/backend/internal/platform/database"
)

// SystemRepository defines database operations for system health and readiness checks.
type SystemRepository interface {
	Ping(ctx context.Context) error
}

type gormSystemRepository struct {
	db *database.DB
}

// NewSystemRepository creates a new GORM-backed SystemRepository.
func NewSystemRepository(db *database.DB) SystemRepository {
	return &gormSystemRepository{db: db}
}

func (r *gormSystemRepository) Ping(ctx context.Context) error {
	if r.db == nil {
		return nil
	}
	return r.db.Ping(ctx)
}
