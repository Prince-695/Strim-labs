package service

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
)

var (
	usernameRegex     = regexp.MustCompile(`^[a-z][a-z0-9_]{2,19}$`)
	reservedUsernames = map[string]struct{}{
		"admin": {}, "administrator": {}, "root": {}, "system": {},
		"api": {}, "auth": {}, "support": {}, "help": {},
		"security": {}, "billing": {}, "app": {}, "dev": {},
		"status": {}, "strim": {}, "strimlabs": {}, "owner": {},
		"null": {}, "undefined": {}, "webhook": {}, "test": {},
	}
)

type UserService interface {
	CheckUsername(ctx context.Context, username string) (*domain.CheckUsernameResponse, error)
	GetMe(ctx context.Context, userID string) (*domain.UserResponse, error)
	SetUsername(ctx context.Context, userID string, req domain.SetUsernameRequest) (*domain.UserResponse, error)
	UpdateProfile(ctx context.Context, userID string, req domain.UpdateUserRequest) (*domain.UserResponse, error)
}

type userService struct {
	userRepo repository.UserRepository
}

func NewUserService(userRepo repository.UserRepository) UserService {
	return &userService{
		userRepo: userRepo,
	}
}

// CheckUsername checks format, reserved list, and database uniqueness.
func (s *userService) CheckUsername(ctx context.Context, username string) (*domain.CheckUsernameResponse, error) {
	norm := strings.ToLower(strings.TrimSpace(username))
	if !usernameRegex.MatchString(norm) {
		return &domain.CheckUsernameResponse{Username: norm, Available: false}, nil
	}

	if _, isReserved := reservedUsernames[norm]; isReserved {
		return &domain.CheckUsernameResponse{Username: norm, Available: false}, nil
	}

	_, err := s.userRepo.FindByUsername(ctx, norm)
	if err == nil {
		return &domain.CheckUsernameResponse{Username: norm, Available: false}, nil
	}
	if errors.Is(err, repository.ErrUserNotFound) {
		return &domain.CheckUsernameResponse{Username: norm, Available: true}, nil
	}

	return nil, domain.NewInternalError(err)
}

// GetMe retrieves the authenticated user's profile.
func (s *userService) GetMe(ctx context.Context, userID string) (*domain.UserResponse, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, domain.NewNotFoundError("User profile not found")
		}
		return nil, domain.NewInternalError(err)
	}
	resp := domain.ToUserResponse(user)
	return &resp, nil
}

// SetUsername claims a username one-time for a verified user.
func (s *userService) SetUsername(ctx context.Context, userID string, req domain.SetUsernameRequest) (*domain.UserResponse, error) {
	norm := strings.ToLower(strings.TrimSpace(req.Username))

	if !usernameRegex.MatchString(norm) {
		return nil, domain.NewValidationError("Username must be 3-20 characters, lowercase alphanumeric or underscore, and start with a letter", nil)
	}

	if _, isReserved := reservedUsernames[norm]; isReserved {
		return nil, domain.NewReservedUsernameError()
	}

	// Fetch user to confirm existence and current username state
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, domain.NewNotFoundError("User not found")
		}
		return nil, domain.NewInternalError(err)
	}

	if user.Username != nil && *user.Username != "" {
		return nil, domain.NewUsernameAlreadySetError()
	}

	// Check if already claimed by someone else
	existing, err := s.userRepo.FindByUsername(ctx, norm)
	if err == nil && existing.ID != userID {
		return nil, domain.NewUsernameTakenError()
	} else if err != nil && !errors.Is(err, repository.ErrUserNotFound) {
		return nil, domain.NewInternalError(err)
	}

	if err := s.userRepo.SetUsername(ctx, userID, norm); err != nil {
		var appErr *domain.AppError
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		return nil, domain.NewInternalError(err)
	}

	user.Username = &norm
	resp := domain.ToUserResponse(user)
	return &resp, nil
}

// UpdateProfile updates the user's first and last name.
func (s *userService) UpdateProfile(ctx context.Context, userID string, req domain.UpdateUserRequest) (*domain.UserResponse, error) {
	firstName := strings.TrimSpace(req.FirstName)
	lastName := strings.TrimSpace(req.LastName)

	if firstName == "" || lastName == "" {
		return nil, domain.NewValidationError("First name and last name are required", nil)
	}

	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, domain.NewNotFoundError("User not found")
		}
		return nil, domain.NewInternalError(err)
	}

	user.FirstName = firstName
	user.LastName = lastName

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, domain.NewInternalError(err)
	}

	resp := domain.ToUserResponse(user)
	return &resp, nil
}
