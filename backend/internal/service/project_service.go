package service

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// ProjectService defines business logic for managing projects and domain ownership verification.
type ProjectService interface {
	CreateProject(ctx context.Context, orgID string, req domain.CreateProjectRequest) (*domain.ProjectResponse, error)
	ListProjects(ctx context.Context, orgID string) ([]*domain.ProjectResponse, error)
	GetProject(ctx context.Context, orgID, projectID string) (*domain.ProjectDetailResponse, error)
	UpdateProject(ctx context.Context, orgID, projectID string, req domain.UpdateProjectRequest) (*domain.ProjectResponse, error)
	DeleteProject(ctx context.Context, orgID, projectID string) error

	InitiateVerification(ctx context.Context, orgID, projectID string, req domain.InitiateVerificationRequest) (*domain.VerificationResponse, error)
	CheckVerification(ctx context.Context, orgID, projectID string) (*domain.CheckVerificationResponse, error)
	GetVerificationStatus(ctx context.Context, orgID, projectID string) (*domain.VerificationResponse, error)
}

type projectService struct {
	projectRepo      repository.ProjectRepository
	verificationRepo repository.VerificationRepository
	projectCache     cache.ProjectCache
	ssrfGuard        *netguard.SSRFGuard
	verifier         *VerificationEngine
}

// NewProjectService instantiates a ProjectService implementation.
func NewProjectService(
	projectRepo repository.ProjectRepository,
	verificationRepo repository.VerificationRepository,
	projectCache cache.ProjectCache,
	ssrfGuard *netguard.SSRFGuard,
	verifier *VerificationEngine,
) ProjectService {
	return &projectService{
		projectRepo:      projectRepo,
		verificationRepo: verificationRepo,
		projectCache:     projectCache,
		ssrfGuard:        ssrfGuard,
		verifier:         verifier,
	}
}

// CreateProject validates input, enforces SSRF rules, and persists a new project within org limit.
func (s *projectService) CreateProject(ctx context.Context, orgID string, req domain.CreateProjectRequest) (*domain.ProjectResponse, error) {
	cleanName := strings.TrimSpace(req.Name)
	if cleanName == "" {
		return nil, domain.NewValidationError("Project name cannot be empty", nil)
	}

	cleanSlug := strings.ToLower(strings.TrimSpace(req.Slug))
	if !slugRegex.MatchString(cleanSlug) {
		return nil, domain.NewValidationError("Project slug must be 2-50 lowercase alphanumeric characters or hyphens", nil)
	}
	if _, reserved := reservedSlugs[cleanSlug]; reserved {
		return nil, domain.NewConflictError(domain.ErrCodeReservedSlug, "This slug is reserved and cannot be used")
	}

	// 1. SSRF check on base URL
	validatedURL, err := s.ssrfGuard.ValidateTargetURL(ctx, req.BaseURL)
	if err != nil {
		return nil, err
	}
	normalizedBaseURL := strings.TrimRight(validatedURL.String(), "/")

	env := req.Environment
	if env == "" {
		env = domain.EnvProduction
	}
	if !env.IsValid() {
		return nil, domain.NewValidationError("Invalid environment; must be development, staging, or production", nil)
	}

	project := &domain.Project{
		OrgID:              orgID,
		Name:               cleanName,
		Slug:               cleanSlug,
		Description:        strings.TrimSpace(req.Description),
		BaseURL:            normalizedBaseURL,
		Environment:        env,
		VerificationStatus: domain.StatusUnverified,
	}

	if err := s.projectRepo.CreateWithLimitCheck(ctx, project); err != nil {
		return nil, err
	}

	return domain.ToProjectResponse(project), nil
}

// ListProjects returns all active projects for an organization (up to 5).
func (s *projectService) ListProjects(ctx context.Context, orgID string) ([]*domain.ProjectResponse, error) {
	projects, err := s.projectRepo.ListByOrg(ctx, orgID)
	if err != nil {
		return nil, err
	}

	res := make([]*domain.ProjectResponse, 0, len(projects))
	for _, p := range projects {
		res = append(res, domain.ToProjectResponse(p))
	}
	return res, nil
}

// GetProject retrieves a single project with rolling 1h stats.
func (s *projectService) GetProject(ctx context.Context, orgID, projectID string) (*domain.ProjectDetailResponse, error) {
	var project *domain.Project

	if s.projectCache != nil {
		if cached, ok := s.projectCache.GetProject(orgID, projectID); ok {
			project = cached
		}
	}

	if project == nil {
		var err error
		project, err = s.projectRepo.FindByID(ctx, orgID, projectID)
		if err != nil {
			return nil, err
		}
		if s.projectCache != nil {
			s.projectCache.SetProject(orgID, projectID, project, 60*time.Second)
		}
	}

	baseResp := domain.ToProjectResponse(project)
	detail := &domain.ProjectDetailResponse{
		ProjectResponse: *baseResp,
		Stats1h: domain.ProjectStats1h{
			Requests:  0,
			P95Ms:     0,
			ErrorRate: 0,
		},
	}
	return detail, nil
}

// UpdateProject updates mutable settings and resets verification if host changed.
func (s *projectService) UpdateProject(ctx context.Context, orgID, projectID string, req domain.UpdateProjectRequest) (*domain.ProjectResponse, error) {
	project, err := s.projectRepo.FindByID(ctx, orgID, projectID)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		cleanName := strings.TrimSpace(*req.Name)
		if cleanName != "" {
			project.Name = cleanName
		}
	}

	if req.Description != nil {
		project.Description = strings.TrimSpace(*req.Description)
	}

	if req.Environment != nil {
		if !req.Environment.IsValid() {
			return nil, domain.NewValidationError("Invalid environment; must be development, staging, or production", nil)
		}
		project.Environment = *req.Environment
	}

	if req.BaseURL != nil {
		validatedURL, err := s.ssrfGuard.ValidateTargetURL(ctx, *req.BaseURL)
		if err != nil {
			return nil, err
		}
		newBaseURL := strings.TrimRight(validatedURL.String(), "/")

		oldU, errOld := url.Parse(project.BaseURL)
		if errOld == nil && !strings.EqualFold(oldU.Hostname(), validatedURL.Hostname()) {
			// Hostname changed: reset verification state
			project.VerificationStatus = domain.StatusUnverified
			project.VerifiedAt = nil
		}
		project.BaseURL = newBaseURL
	}

	if err := s.projectRepo.Update(ctx, project); err != nil {
		return nil, err
	}

	if s.projectCache != nil {
		s.projectCache.Invalidate(orgID, projectID)
	}

	return domain.ToProjectResponse(project), nil
}

// DeleteProject performs a soft delete and flushes the project cache.
func (s *projectService) DeleteProject(ctx context.Context, orgID, projectID string) error {
	if err := s.projectRepo.Delete(ctx, orgID, projectID); err != nil {
		return err
	}
	if s.projectCache != nil {
		s.projectCache.Invalidate(orgID, projectID)
	}
	return nil
}

// InitiateVerification starts a proof of domain ownership challenge.
func (s *projectService) InitiateVerification(ctx context.Context, orgID, projectID string, req domain.InitiateVerificationRequest) (*domain.VerificationResponse, error) {
	project, err := s.projectRepo.FindByID(ctx, orgID, projectID)
	if err != nil {
		return nil, err
	}

	method := req.Method
	if method != domain.MethodDNS && method != domain.MethodFile {
		method = domain.MethodDNS
	}

	// Generate high-entropy verification token
	token := s.verifier.GenerateToken()
	expiresAt := time.Now().UTC().Add(24 * time.Hour)

	verification := &domain.ProjectVerification{
		ProjectID: project.ID,
		Method:    method,
		Token:     token,
		Status:    domain.StatusPending,
		ExpiresAt: expiresAt,
	}

	if err := s.verificationRepo.Create(ctx, verification); err != nil {
		return nil, err
	}

	instructions := s.verifier.BuildInstructions(project.BaseURL, token)

	return &domain.VerificationResponse{
		Status:       domain.StatusPending,
		Method:       method,
		Token:        fmt.Sprintf("strim-verify=%s", token),
		Instructions: instructions,
		ExpiresAt:    expiresAt,
	}, nil
}

// CheckVerification immediately probes DNS or HTTP file to verify domain ownership.
func (s *projectService) CheckVerification(ctx context.Context, orgID, projectID string) (*domain.CheckVerificationResponse, error) {
	project, err := s.projectRepo.FindByID(ctx, orgID, projectID)
	if err != nil {
		return nil, err
	}

	verification, err := s.verificationRepo.FindActiveByProject(ctx, project.ID)
	if err != nil {
		return nil, err
	}
	if verification == nil {
		return nil, domain.NewBadRequestError("No verification challenge found for this project; please initiate verification first", nil)
	}

	now := time.Now().UTC()
	if now.After(verification.ExpiresAt) {
		verification.Status = domain.StatusFailed
		verification.CheckedAt = &now
		_ = s.verificationRepo.Update(ctx, verification)
		return &domain.CheckVerificationResponse{
			Status: domain.StatusFailed,
			Reason: "Verification challenge has expired; please initiate a new verification",
		}, nil
	}

	var verified bool
	var failureReason string

	switch verification.Method {
	case domain.MethodDNS:
		verified, failureReason = s.verifier.VerifyDNS(ctx, project.BaseURL, verification.Token)
	case domain.MethodFile:
		verified, failureReason = s.verifier.VerifyHTTP(ctx, project.BaseURL, verification.Token)
	default:
		// Attempt DNS first, fallback to HTTP
		verified, failureReason = s.verifier.VerifyDNS(ctx, project.BaseURL, verification.Token)
		if !verified {
			verified, failureReason = s.verifier.VerifyHTTP(ctx, project.BaseURL, verification.Token)
		}
	}

	verification.CheckedAt = &now
	if verified {
		verification.Status = domain.StatusVerified
		if err := s.verificationRepo.Update(ctx, verification); err != nil {
			return nil, err
		}
		if err := s.verificationRepo.UpdateProjectVerificationStatus(ctx, project.ID, domain.StatusVerified, &now); err != nil {
			return nil, err
		}
		if s.projectCache != nil {
			s.projectCache.Invalidate(orgID, projectID)
		}
		return &domain.CheckVerificationResponse{
			Status:     domain.StatusVerified,
			VerifiedAt: &now,
		}, nil
	}

	verification.Status = domain.StatusFailed
	_ = s.verificationRepo.Update(ctx, verification)
	return &domain.CheckVerificationResponse{
		Status: domain.StatusFailed,
		Reason: failureReason,
	}, nil
}

// GetVerificationStatus inspects the active domain verification record and instructions.
func (s *projectService) GetVerificationStatus(ctx context.Context, orgID, projectID string) (*domain.VerificationResponse, error) {
	project, err := s.projectRepo.FindByID(ctx, orgID, projectID)
	if err != nil {
		return nil, err
	}

	verification, err := s.verificationRepo.FindActiveByProject(ctx, project.ID)
	if err != nil {
		return nil, err
	}

	if verification == nil {
		instructions := s.verifier.BuildInstructions(project.BaseURL, "")
		return &domain.VerificationResponse{
			Status:       project.VerificationStatus,
			Method:       domain.MethodDNS,
			Token:        "",
			Instructions: instructions,
		}, nil
	}

	instructions := s.verifier.BuildInstructions(project.BaseURL, verification.Token)
	return &domain.VerificationResponse{
		Status:       verification.Status,
		Method:       verification.Method,
		Token:        fmt.Sprintf("strim-verify=%s", verification.Token),
		Instructions: instructions,
		ExpiresAt:    verification.ExpiresAt,
	}, nil
}
