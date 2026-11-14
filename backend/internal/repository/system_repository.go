package repository

import (
	"context"
	"errors"

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
	if r == nil || r.db == nil || r.db.DB == nil {
		return errors.New("database connection not established")
	}
	return r.db.Ping(ctx)
}
