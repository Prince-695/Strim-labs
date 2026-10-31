package service_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"

	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockSystemRepo struct {
	pingErr error
}

func (m *mockSystemRepo) Ping(ctx context.Context) error {
	return m.pingErr
}

func TestSystemService(t *testing.T) {
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	repo := &mockSystemRepo{}

	svc := service.NewSystemService(repo, logger)

	// 1. Health check (healthy)
	status, err := svc.CheckHealth(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "healthy", status["status"])
	assert.Equal(t, "connected", status["database"])

	// 2. Health check (failing DB)
	repo.pingErr = errors.New("connection refused")
	status, err = svc.CheckHealth(context.Background())
	assert.Error(t, err)
	assert.Equal(t, "healthy", status["status"])
	assert.Equal(t, "degraded", status["database"])
}
