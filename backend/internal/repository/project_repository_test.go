package repository

import (
	"context"
	"testing"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestGormProjectRepository_ForeignKeyTest(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	require.NoError(t, err)

	err = db.AutoMigrate(
		&domain.Organization{},
		&domain.OrgMember{},
		&domain.Project{},
	)
	require.NoError(t, err)

	// Create org
	org := &domain.Organization{
		ID:        "01a1e4fd-4daa-7e38-9bfe-b788a80d330e",
		Name:      "Test Org",
		Slug:      "test-org",
		CreatedBy: "user-1",
	}
	require.NoError(t, db.Create(org).Error)

	repo := &GormProjectRepository{db: &database.DB{DB: db}}

	ctx := context.Background()
	proj := &domain.Project{
		OrgID:              org.ID,
		Name:               "Checkout API",
		Slug:               "checkout-api",
		BaseURL:            "https://api.example.com",
		Environment:        domain.EnvProduction,
		VerificationStatus: domain.StatusUnverified,
	}

	err = repo.CreateWithLimitCheck(ctx, proj)
	assert.NoError(t, err)
}
