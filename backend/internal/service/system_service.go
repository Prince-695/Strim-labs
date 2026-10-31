package service

import (
	"context"
	"log/slog"

	"github.com/Prince-695/strim/backend/internal/repository"
)

// SystemService defines operations for system health reporting.
type SystemService interface {
	CheckHealth(ctx context.Context) (map[string]string, error)
}

type systemService struct {
	repo   repository.SystemRepository
	logger *slog.Logger
}

// NewSystemService constructs a new SystemService with injected dependencies.
func NewSystemService(repo repository.SystemRepository, logger *slog.Logger) SystemService {
	return &systemService{
		repo:   repo,
		logger: logger,
	}
}

func (s *systemService) CheckHealth(ctx context.Context) (map[string]string, error) {
	result := map[string]string{
		"status": "healthy",
	}

	if err := s.repo.Ping(ctx); err != nil {
		s.logger.WarnContext(ctx, "health check: database connectivity degraded", slog.Any("error", err))
		result["database"] = "degraded"
		return result, err
	}

	result["database"] = "connected"
	return result, nil
}
