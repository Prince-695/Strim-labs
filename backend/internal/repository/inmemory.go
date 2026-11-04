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

// InMemoryProjectRepository provides an in-memory thread-safe ProjectRepository implementation.
type InMemoryProjectRepository struct {
	mu       sync.RWMutex
	projects map[string]*domain.Project
}

func NewInMemoryProjectRepository() *InMemoryProjectRepository {
	return &InMemoryProjectRepository{
		projects: make(map[string]*domain.Project),
	}
}

func (r *InMemoryProjectRepository) CreateWithLimitCheck(ctx context.Context, project *domain.Project) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	count := 0
	for _, p := range r.projects {
		if p.OrgID == project.OrgID && !p.DeletedAt.Valid {
			count++
		}
	}
	if count >= 5 {
		return domain.NewProjectLimitReachedError()
	}

	normSlug := strings.ToLower(strings.TrimSpace(project.Slug))
	for _, p := range r.projects {
		if p.OrgID == project.OrgID && !p.DeletedAt.Valid && strings.EqualFold(p.Slug, normSlug) {
			return domain.NewConflictError(domain.ErrCodeSlugTaken, "A project with this slug already exists in this organization")
		}
	}

	if project.ID == "" {
		project.ID = "proj-" + time.Now().UTC().Format("20060102150405.000000000")
	}
	project.Slug = normSlug
	if project.CreatedAt.IsZero() {
		project.CreatedAt = time.Now().UTC()
	}
	project.UpdatedAt = project.CreatedAt
	if project.VerificationStatus == "" {
		project.VerificationStatus = domain.StatusUnverified
	}
	if project.Environment == "" {
		project.Environment = domain.EnvProduction
	}

	copyP := *project
	r.projects[project.ID] = &copyP
	return nil
}

func (r *InMemoryProjectRepository) FindByID(ctx context.Context, orgID, projectID string) (*domain.Project, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p, ok := r.projects[projectID]
	if !ok || p.OrgID != orgID || p.DeletedAt.Valid {
		return nil, domain.NewProjectNotFoundError()
	}
	copyP := *p
	return &copyP, nil
}

func (r *InMemoryProjectRepository) FindBySlug(ctx context.Context, orgID, slug string) (*domain.Project, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	normSlug := strings.ToLower(strings.TrimSpace(slug))
	for _, p := range r.projects {
		if p.OrgID == orgID && !p.DeletedAt.Valid && strings.EqualFold(p.Slug, normSlug) {
			copyP := *p
			return &copyP, nil
		}
	}
	return nil, domain.NewProjectNotFoundError()
}

func (r *InMemoryProjectRepository) ListByOrg(ctx context.Context, orgID string) ([]*domain.Project, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []*domain.Project
	for _, p := range r.projects {
		if p.OrgID == orgID && !p.DeletedAt.Valid {
			copyP := *p
			result = append(result, &copyP)
		}
	}
	return result, nil
}

func (r *InMemoryProjectRepository) Update(ctx context.Context, project *domain.Project) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, ok := r.projects[project.ID]
	if !ok || p.OrgID != project.OrgID || p.DeletedAt.Valid {
		return domain.NewProjectNotFoundError()
	}

	p.Name = project.Name
	p.Description = project.Description
	p.BaseURL = project.BaseURL
	p.Environment = project.Environment
	p.VerificationStatus = project.VerificationStatus
	p.VerifiedAt = project.VerifiedAt
	p.UpdatedAt = time.Now().UTC()
	return nil
}

func (r *InMemoryProjectRepository) Delete(ctx context.Context, orgID, projectID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, ok := r.projects[projectID]
	if !ok || p.OrgID != orgID || p.DeletedAt.Valid {
		return domain.NewProjectNotFoundError()
	}

	p.DeletedAt = gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}
	return nil
}

func (r *InMemoryProjectRepository) CountByOrg(ctx context.Context, orgID string) (int64, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var count int64
	for _, p := range r.projects {
		if p.OrgID == orgID && !p.DeletedAt.Valid {
			count++
		}
	}
	return count, nil
}

// InMemoryVerificationRepository provides in-memory VerificationRepository implementation.
type InMemoryVerificationRepository struct {
	mu            sync.RWMutex
	verifications map[string]*domain.ProjectVerification
	projectRepo   *InMemoryProjectRepository
}

func NewInMemoryVerificationRepository(projectRepo *InMemoryProjectRepository) *InMemoryVerificationRepository {
	return &InMemoryVerificationRepository{
		verifications: make(map[string]*domain.ProjectVerification),
		projectRepo:   projectRepo,
	}
}

func (r *InMemoryVerificationRepository) Create(ctx context.Context, verification *domain.ProjectVerification) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if verification.ID == "" {
		verification.ID = "verif-" + time.Now().UTC().Format("20060102150405.000000000")
	}
	if verification.CreatedAt.IsZero() {
		verification.CreatedAt = time.Now().UTC()
	}
	copyV := *verification
	r.verifications[verification.ID] = &copyV
	return nil
}

func (r *InMemoryVerificationRepository) FindActiveByProject(ctx context.Context, projectID string) (*domain.ProjectVerification, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var latest *domain.ProjectVerification
	for _, v := range r.verifications {
		if v.ProjectID == projectID {
			if latest == nil || v.CreatedAt.After(latest.CreatedAt) {
				latest = v
			}
		}
	}
	if latest == nil {
		return nil, nil
	}
	copyV := *latest
	return &copyV, nil
}

func (r *InMemoryVerificationRepository) Update(ctx context.Context, verification *domain.ProjectVerification) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	v, ok := r.verifications[verification.ID]
	if !ok {
		return errors.New("verification not found")
	}
	v.Status = verification.Status
	v.CheckedAt = verification.CheckedAt
	return nil
}

func (r *InMemoryVerificationRepository) UpdateProjectVerificationStatus(ctx context.Context, projectID string, status domain.VerificationStatus, verifiedAt *time.Time) error {
	if r.projectRepo == nil {
		return nil
	}
	r.projectRepo.mu.Lock()
	defer r.projectRepo.mu.Unlock()

	p, ok := r.projectRepo.projects[projectID]
	if !ok || p.DeletedAt.Valid {
		return domain.NewProjectNotFoundError()
	}
	p.VerificationStatus = status
	p.VerifiedAt = verifiedAt
	p.UpdatedAt = time.Now().UTC()
	return nil
}
