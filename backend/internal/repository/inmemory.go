package repository

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// InMemoryUserRepository provides an in-memory thread-safe UserRepository implementation for testing.
type InMemoryUserRepository struct {
	mu    sync.RWMutex
	users map[string]*domain.User
}

func NewInMemoryUserRepository() *InMemoryUserRepository {
	return &InMemoryUserRepository{
		users: make(map[string]*domain.User),
	}
}

func (r *InMemoryUserRepository) Create(ctx context.Context, user *domain.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	email := strings.ToLower(strings.TrimSpace(user.Email))
	for _, u := range r.users {
		if strings.EqualFold(u.Email, email) {
			return errors.New("duplicate key value violates unique constraint")
		}
	}
	user.Email = email
	if user.CreatedAt.IsZero() {
		user.CreatedAt = time.Now().UTC()
	}
	user.UpdatedAt = user.CreatedAt
	copyUser := *user
	r.users[user.ID] = &copyUser
	return nil
}

func (r *InMemoryUserRepository) FindByID(ctx context.Context, id string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	copyUser := *u
	return &copyUser, nil
}

func (r *InMemoryUserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	clean := strings.ToLower(strings.TrimSpace(email))
	for _, u := range r.users {
		if strings.EqualFold(u.Email, clean) {
			copyUser := *u
			return &copyUser, nil
		}
	}
	return nil, ErrUserNotFound
}

func (r *InMemoryUserRepository) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, u := range r.users {
		if u.Username != nil && strings.EqualFold(*u.Username, username) {
			copyUser := *u
			return &copyUser, nil
		}
	}
	return nil, ErrUserNotFound
}

func (r *InMemoryUserRepository) Update(ctx context.Context, user *domain.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.users[user.ID]; !ok {
		return ErrUserNotFound
	}
	user.UpdatedAt = time.Now().UTC()
	copyUser := *user
	r.users[user.ID] = &copyUser
	return nil
}

func (r *InMemoryUserRepository) UpdatePassword(ctx context.Context, userID, newPasswordHash string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.users[userID]
	if !ok {
		return ErrUserNotFound
	}
	u.PasswordHash = newPasswordHash
	u.UpdatedAt = time.Now().UTC()
	return nil
}

func (r *InMemoryUserRepository) SetVerified(ctx context.Context, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.users[userID]
	if !ok {
		return ErrUserNotFound
	}
	u.IsVerified = true
	u.UpdatedAt = time.Now().UTC()
	return nil
}

// InMemoryAuthRepository provides an in-memory thread-safe AuthRepository implementation for testing.
type InMemoryAuthRepository struct {
	mu     sync.RWMutex
	tokens map[string]*domain.RefreshToken
}

func NewInMemoryAuthRepository() *InMemoryAuthRepository {
	return &InMemoryAuthRepository{
		tokens: make(map[string]*domain.RefreshToken),
	}
}

func (r *InMemoryAuthRepository) CreateRefreshToken(ctx context.Context, token *domain.RefreshToken) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if token.CreatedAt.IsZero() {
		token.CreatedAt = time.Now().UTC()
	}
	copyToken := *token
	r.tokens[token.TokenHash] = &copyToken
	return nil
}

func (r *InMemoryAuthRepository) FindRefreshTokenByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.tokens[tokenHash]
	if !ok {
		return nil, ErrRefreshTokenNotFound
	}
	copyToken := *t
	return &copyToken, nil
}

func (r *InMemoryAuthRepository) RevokeRefreshToken(ctx context.Context, tokenHash, replacedBy string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	t, ok := r.tokens[tokenHash]
	if !ok {
		return ErrRefreshTokenNotFound
	}
	now := time.Now().UTC()
	t.RevokedAt = &now
	if replacedBy != "" {
		t.ReplacedBy = &replacedBy
	}
	return nil
}

func (r *InMemoryAuthRepository) RevokeFamily(ctx context.Context, familyID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now().UTC()
	for _, t := range r.tokens {
		if t.FamilyID == familyID && t.RevokedAt == nil {
			t.RevokedAt = &now
		}
	}
	return nil
}

func (r *InMemoryAuthRepository) RevokeAllUserSessions(ctx context.Context, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now().UTC()
	for _, t := range r.tokens {
		if t.UserID == userID && t.RevokedAt == nil {
			t.RevokedAt = &now
		}
	}
	return nil
}

func (r *InMemoryAuthRepository) RevokeSession(ctx context.Context, sessionID, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now().UTC()
	for _, t := range r.tokens {
		if t.ID == sessionID && t.UserID == userID && t.RevokedAt == nil {
			t.RevokedAt = &now
		}
	}
	return nil
}

func (r *InMemoryAuthRepository) ListActiveSessions(ctx context.Context, userID string) ([]domain.RefreshToken, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var list []domain.RefreshToken
	now := time.Now().UTC()
	for _, t := range r.tokens {
		if t.UserID == userID && t.RevokedAt == nil && t.ExpiresAt.After(now) {
			list = append(list, *t)
		}
	}
	return list, nil
}

// InMemoryOTPRepository provides an in-memory thread-safe OTPRepository implementation for testing.
type InMemoryOTPRepository struct {
	mu   sync.RWMutex
	otps map[string]*domain.OTPCode
}

func NewInMemoryOTPRepository() *InMemoryOTPRepository {
	return &InMemoryOTPRepository{
		otps: make(map[string]*domain.OTPCode),
	}
}

func (r *InMemoryOTPRepository) CreateOTP(ctx context.Context, otp *domain.OTPCode) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if otp.CreatedAt.IsZero() {
		otp.CreatedAt = time.Now().UTC()
	}
	otp.Email = strings.ToLower(strings.TrimSpace(otp.Email))
	copyOTP := *otp
	r.otps[otp.ID] = &copyOTP
	return nil
}

func (r *InMemoryOTPRepository) FindLatestActive(ctx context.Context, email, purpose string) (*domain.OTPCode, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	normEmail := strings.ToLower(strings.TrimSpace(email))
	var latest *domain.OTPCode
	now := time.Now().UTC()
	for _, o := range r.otps {
		if strings.EqualFold(o.Email, normEmail) && o.Purpose == purpose && o.UsedAt == nil && o.ExpiresAt.After(now) {
			if latest == nil || o.CreatedAt.After(latest.CreatedAt) {
				latest = o
			}
		}
	}
	if latest == nil {
		return nil, ErrOTPNotFound
	}
	copyOTP := *latest
	return &copyOTP, nil
}

func (r *InMemoryOTPRepository) IncrementAttempts(ctx context.Context, otpID string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	o, ok := r.otps[otpID]
	if !ok {
		return 0, ErrOTPNotFound
	}
	o.Attempts++
	return o.Attempts, nil
}

func (r *InMemoryOTPRepository) MarkUsed(ctx context.Context, otpID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	o, ok := r.otps[otpID]
	if !ok {
		return ErrOTPNotFound
	}
	now := time.Now().UTC()
	o.UsedAt = &now
	return nil
}

// InMemoryOAuthRepository provides an in-memory thread-safe OAuthRepository implementation for testing.
type InMemoryOAuthRepository struct {
	mu       sync.RWMutex
	accounts map[string]*domain.OAuthAccount
}

func NewInMemoryOAuthRepository() *InMemoryOAuthRepository {
	return &InMemoryOAuthRepository{
		accounts: make(map[string]*domain.OAuthAccount),
	}
}

func (r *InMemoryOAuthRepository) FindByProvider(ctx context.Context, provider, providerUserID string) (*domain.OAuthAccount, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	key := provider + ":" + providerUserID
	acc, ok := r.accounts[key]
	if !ok {
		return nil, ErrOAuthAccountNotFound
	}
	copyAcc := *acc
	return &copyAcc, nil
}

func (r *InMemoryOAuthRepository) Create(ctx context.Context, account *domain.OAuthAccount) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := account.Provider + ":" + account.ProviderUserID
	copyAcc := *account
	r.accounts[key] = &copyAcc
	return nil
}
