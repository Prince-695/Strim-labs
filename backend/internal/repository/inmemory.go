package repository

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"gorm.io/gorm"
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

func (r *InMemoryUserRepository) SetUsername(ctx context.Context, userID, username string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.users[userID]
	if !ok {
		return ErrUserNotFound
	}
	if u.Username != nil {
		return domain.NewUsernameAlreadySetError()
	}
	cleanUsername := strings.ToLower(strings.TrimSpace(username))
	for _, other := range r.users {
		if other.Username != nil && strings.EqualFold(*other.Username, cleanUsername) {
			return domain.NewUsernameTakenError()
		}
	}
	u.Username = &cleanUsername
	u.UpdatedAt = time.Now().UTC()
	return nil
}

func (r *InMemoryUserRepository) FindByOAuth(ctx context.Context, provider, providerUserID string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, u := range r.users {
		if u.OAuthProvider != nil && u.OAuthProviderID != nil &&
			*u.OAuthProvider == provider && *u.OAuthProviderID == providerUserID {
			copyUser := *u
			return &copyUser, nil
		}
	}
	return nil, ErrUserNotFound
}

func (r *InMemoryUserRepository) LinkOAuth(ctx context.Context, userID, provider, providerUserID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.users[userID]
	if !ok {
		return ErrUserNotFound
	}
	u.OAuthProvider = &provider
	u.OAuthProviderID = &providerUserID
	u.IsVerified = true
	u.UpdatedAt = time.Now().UTC()
	return nil
}

// InMemoryOTPRepository provides an in-memory thread-safe OTPRepository implementation for testing.
type InMemoryOTPRepository struct {
	mu   sync.RWMutex
	otps map[string]*domain.OTP
}

func NewInMemoryOTPRepository() *InMemoryOTPRepository {
	return &InMemoryOTPRepository{
		otps: make(map[string]*domain.OTP),
	}
}

func (r *InMemoryOTPRepository) CreateOTP(ctx context.Context, otp *domain.OTP) error {
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

func (r *InMemoryOTPRepository) FindLatestActive(ctx context.Context, email, purpose string) (*domain.OTP, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	normEmail := strings.ToLower(strings.TrimSpace(email))
	var latest *domain.OTP
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

// InMemoryOrgRepository provides an in-memory thread-safe OrgRepository implementation.
type InMemoryOrgRepository struct {
	mu         sync.RWMutex
	orgs       map[string]*domain.Organization
	memberRepo *InMemoryMemberRepository
}

func NewInMemoryOrgRepository(memberRepo *InMemoryMemberRepository) *InMemoryOrgRepository {
	return &InMemoryOrgRepository{
		orgs:       make(map[string]*domain.Organization),
		memberRepo: memberRepo,
	}
}

func (r *InMemoryOrgRepository) CreateWithLimitCheck(ctx context.Context, org *domain.Organization, ownerUserID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Check user limit < 3
	count, err := r.memberRepo.CountUserOrgs(ctx, ownerUserID)
	if err != nil {
		return err
	}
	if count >= 3 {
		return domain.NewOrgLimitReachedError()
	}

	normSlug := strings.ToLower(strings.TrimSpace(org.Slug))
	for _, o := range r.orgs {
		if o.DeletedAt.Valid {
			continue
		}
		if strings.EqualFold(o.Slug, normSlug) {
			return domain.NewSlugTakenError()
		}
	}

	if org.ID == "" {
		org.ID = "org-" + normSlug
	}
	org.Slug = normSlug
	org.CreatedBy = ownerUserID
	if org.CreatedAt.IsZero() {
		org.CreatedAt = time.Now().UTC()
	}
	org.UpdatedAt = org.CreatedAt

	copyOrg := *org
	r.orgs[org.ID] = &copyOrg

	// Add owner
	_ = r.memberRepo.AddMemberDirect(&domain.OrgMember{
		OrgID:    org.ID,
		UserID:   ownerUserID,
		Role:     domain.RoleOwner,
		JoinedAt: time.Now().UTC(),
	})

	org.Role = domain.RoleOwner
	org.MemberCount = 1
	org.ProjectCount = 0

	return nil
}

func (r *InMemoryOrgRepository) FindByID(ctx context.Context, id string) (*domain.Organization, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	o, ok := r.orgs[id]
	if !ok || o.DeletedAt.Valid {
		return nil, ErrOrgNotFound
	}

	copyOrg := *o
	if r.memberRepo != nil {
		copyOrg.MemberCount = r.memberRepo.CountOrgMembers(id)
	}
	return &copyOrg, nil
}

func (r *InMemoryOrgRepository) FindBySlug(ctx context.Context, slug string) (*domain.Organization, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	norm := strings.ToLower(strings.TrimSpace(slug))
	for _, o := range r.orgs {
		if !o.DeletedAt.Valid && strings.EqualFold(o.Slug, norm) {
			copyOrg := *o
			if r.memberRepo != nil {
				copyOrg.MemberCount = r.memberRepo.CountOrgMembers(o.ID)
			}
			return &copyOrg, nil
		}
	}
	return nil, ErrOrgNotFound
}

func (r *InMemoryOrgRepository) ListByUser(ctx context.Context, userID string) ([]*domain.Organization, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*domain.Organization
	memberships := r.memberRepo.GetUserMemberships(userID)
	for _, m := range memberships {
		o, ok := r.orgs[m.OrgID]
		if ok && !o.DeletedAt.Valid {
			copyOrg := *o
			copyOrg.Role = m.Role
			copyOrg.MemberCount = r.memberRepo.CountOrgMembers(o.ID)
			copyOrg.ProjectCount = 0
			list = append(list, &copyOrg)
		}
	}
	return list, nil
}

func (r *InMemoryOrgRepository) Update(ctx context.Context, org *domain.Organization) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	o, ok := r.orgs[org.ID]
	if !ok || o.DeletedAt.Valid {
		return ErrOrgNotFound
	}
	o.Name = org.Name
	o.Description = org.Description
	o.UpdatedAt = time.Now().UTC()
	return nil
}

func (r *InMemoryOrgRepository) SoftDelete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	o, ok := r.orgs[id]
	if !ok || o.DeletedAt.Valid {
		return ErrOrgNotFound
	}
	o.DeletedAt.Time = time.Now().UTC()
	o.DeletedAt.Valid = true
	return nil
}

func (r *InMemoryOrgRepository) WithTenantContext(ctx context.Context, orgID string, fn func(tx *gorm.DB) error) error {
	return fn(nil)
}

// InMemoryMemberRepository provides an in-memory thread-safe MemberRepository implementation.
type InMemoryMemberRepository struct {
	mu       sync.RWMutex
	members  map[string]*domain.OrgMember // key: orgID:userID
	userRepo *InMemoryUserRepository
}

func NewInMemoryMemberRepository(userRepo *InMemoryUserRepository) *InMemoryMemberRepository {
	return &InMemoryMemberRepository{
		members:  make(map[string]*domain.OrgMember),
		userRepo: userRepo,
	}
}

func (r *InMemoryMemberRepository) memberKey(orgID, userID string) string {
	return orgID + ":" + userID
}

func (r *InMemoryMemberRepository) AddMemberDirect(member *domain.OrgMember) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	copyMember := *member
	r.members[r.memberKey(member.OrgID, member.UserID)] = &copyMember
	return nil
}

func (r *InMemoryMemberRepository) AddMemberWithLimitCheck(ctx context.Context, member *domain.OrgMember) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Check target user org limit
	count := 0
	for _, m := range r.members {
		if m.UserID == member.UserID {
			count++
		}
	}
	if count >= 3 {
		return domain.NewTargetOrgLimitReachedError()
	}

	key := r.memberKey(member.OrgID, member.UserID)
	if _, exists := r.members[key]; exists {
		return domain.NewAlreadyMemberError()
	}

	copyMember := *member
	if copyMember.JoinedAt.IsZero() {
		copyMember.JoinedAt = time.Now().UTC()
	}
	r.members[key] = &copyMember
	return nil
}

func (r *InMemoryMemberRepository) FindMember(ctx context.Context, orgID, userID string) (*domain.OrgMember, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	m, ok := r.members[r.memberKey(orgID, userID)]
	if !ok {
		return nil, ErrMemberNotFound
	}
	copyMember := *m
	return &copyMember, nil
}

func (r *InMemoryMemberRepository) ListMembers(ctx context.Context, orgID string, query domain.ListMembersQuery) ([]*domain.OrgMemberDetailResponse, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var details []*domain.OrgMemberDetailResponse
	for _, m := range r.members {
		if m.OrgID == orgID {
			if query.Role != "" && string(m.Role) != query.Role {
				continue
			}

			u, err := r.userRepo.FindByID(ctx, m.UserID)
			if err != nil {
				continue
			}

			if query.Q != "" {
				term := strings.ToLower(strings.TrimSpace(query.Q))
				match := strings.Contains(strings.ToLower(u.FirstName), term) ||
					strings.Contains(strings.ToLower(u.LastName), term) ||
					strings.Contains(strings.ToLower(u.Email), term) ||
					(u.Username != nil && strings.Contains(strings.ToLower(*u.Username), term))
				if !match {
					continue
				}
			}

			details = append(details, &domain.OrgMemberDetailResponse{
				UserID:    u.ID,
				Email:     u.Email,
				FirstName: u.FirstName,
				LastName:  u.LastName,
				Username:  u.Username,
				Role:      m.Role,
				JoinedAt:  m.JoinedAt,
			})
		}
	}
	return details, nil
}

func (r *InMemoryMemberRepository) UpdateRole(ctx context.Context, orgID, userID string, newRole domain.OrgRole) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	m, ok := r.members[r.memberKey(orgID, userID)]
	if !ok {
		return ErrMemberNotFound
	}
	m.Role = newRole
	return nil
}

func (r *InMemoryMemberRepository) RemoveMember(ctx context.Context, orgID, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	key := r.memberKey(orgID, userID)
	if _, ok := r.members[key]; !ok {
		return ErrMemberNotFound
	}
	delete(r.members, key)
	return nil
}

func (r *InMemoryMemberRepository) CountOwners(ctx context.Context, orgID string) (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	count := 0
	for _, m := range r.members {
		if m.OrgID == orgID && m.Role == domain.RoleOwner {
			count++
		}
	}
	return count, nil
}

func (r *InMemoryMemberRepository) CountUserOrgs(ctx context.Context, userID string) (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	count := 0
	for _, m := range r.members {
		if m.UserID == userID {
			count++
		}
	}
	return count, nil
}

func (r *InMemoryMemberRepository) CountOrgMembers(orgID string) int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	count := 0
	for _, m := range r.members {
		if m.OrgID == orgID {
			count++
		}
	}
	return count
}

func (r *InMemoryMemberRepository) GetUserMemberships(userID string) []*domain.OrgMember {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var list []*domain.OrgMember
	for _, m := range r.members {
		if m.UserID == userID {
			copyM := *m
			list = append(list, &copyM)
		}
	}
	return list
}
