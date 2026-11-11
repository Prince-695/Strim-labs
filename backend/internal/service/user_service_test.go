package service_test

import (
	"context"
	"testing"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserService_CheckUsername(t *testing.T) {
	ctx := context.Background()
	userRepo := repository.NewInMemoryUserRepository()
	userSvc := service.NewUserService(userRepo)

	// Pre-seed an existing user with username
	existingUser := &domain.User{
		ID:        "user-1",
		Email:     "ada@example.com",
		FirstName: "Ada",
		LastName:  "Lovelace",
	}
	require.NoError(t, userRepo.Create(ctx, existingUser))
	require.NoError(t, userRepo.SetUsername(ctx, "user-1", "adalovelace"))

	tests := []struct {
		name      string
		username  string
		wantAvail bool
	}{
		{"Valid available", "newuser", true},
		{"Existing taken", "adalovelace", false},
		{"Existing taken case-insensitive", "AdaLovelace", false},
		{"Reserved slug/username", "admin", false},
		{"Reserved system", "system", false},
		{"Too short", "ab", false},
		{"Starts with digit", "1user", false},
		{"Invalid character", "user-name", false},
		{"Contains underscore valid", "user_name", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := userSvc.CheckUsername(ctx, tt.username)
			require.NoError(t, err)
			assert.Equal(t, tt.wantAvail, resp.Available)
		})
	}
}

func TestUserService_SetUsername(t *testing.T) {
	ctx := context.Background()
	userRepo := repository.NewInMemoryUserRepository()
	userSvc := service.NewUserService(userRepo)

	user := &domain.User{
		ID:         "user-2",
		Email:      "charles@example.com",
		FirstName:  "Charles",
		LastName:   "Babbage",
		IsVerified: true,
	}
	require.NoError(t, userRepo.Create(ctx, user))

	// 1. Valid claim
	resp, err := userSvc.SetUsername(ctx, "user-2", domain.SetUsernameRequest{Username: "babbage"})
	require.NoError(t, err)
	require.NotNil(t, resp.Username)
	assert.Equal(t, "babbage", *resp.Username)

	// 2. Second claim must fail with USERNAME_ALREADY_SET
	_, err = userSvc.SetUsername(ctx, "user-2", domain.SetUsernameRequest{Username: "newbabbage"})
	require.Error(t, err)
	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeUsernameAlreadySet, appErr.ErrorCode)

	// 3. Another user claiming taken username
	user3 := &domain.User{
		ID:         "user-3",
		Email:      "alan@example.com",
		FirstName:  "Alan",
		LastName:   "Turing",
		IsVerified: true,
	}
	require.NoError(t, userRepo.Create(ctx, user3))

	_, err = userSvc.SetUsername(ctx, "user-3", domain.SetUsernameRequest{Username: "babbage"})
	require.Error(t, err)
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeUsernameTaken, appErr.ErrorCode)

	// 4. Claiming reserved username
	_, err = userSvc.SetUsername(ctx, "user-3", domain.SetUsernameRequest{Username: "admin"})
	require.Error(t, err)
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeReservedUsername, appErr.ErrorCode)
}

func TestUserService_UpdateProfile(t *testing.T) {
	ctx := context.Background()
	userRepo := repository.NewInMemoryUserRepository()
	userSvc := service.NewUserService(userRepo)

	user := &domain.User{
		ID:        "user-4",
		Email:     "grace@example.com",
		FirstName: "Grace",
		LastName:  "Hopper",
	}
	require.NoError(t, userRepo.Create(ctx, user))

	// Valid update
	resp, err := userSvc.UpdateProfile(ctx, "user-4", domain.UpdateUserRequest{
		FirstName: "Amazing Grace",
		LastName:  "Hopper",
	})
	require.NoError(t, err)
	assert.Equal(t, "Amazing Grace", resp.FirstName)
	assert.Equal(t, "Hopper", resp.LastName)

	// Empty name validation
	_, err = userSvc.UpdateProfile(ctx, "user-4", domain.UpdateUserRequest{
		FirstName: "",
		LastName:  "Hopper",
	})
	require.Error(t, err)
	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeValidationFailed, appErr.ErrorCode)
}
