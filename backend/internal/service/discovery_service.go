package service

import (
	"context"
	"time"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// DiscoveryService manages route ingestion from OpenAPI specifications and route manifests.
type DiscoveryService interface {
	ImportOpenAPI(ctx context.Context, projectID string, specBytes []byte, specURL string) (*domain.DiscoveryRunResponse, error)
	ImportManifest(ctx context.Context, projectID string, manifest *domain.DiscoveryManifest) (*domain.DiscoveryRunResponse, error)
	GetDiscoveryRun(ctx context.Context, projectID, runID string) (*domain.DiscoveryRunResponse, error)
	ListDiscoveryRuns(ctx context.Context, projectID string, limit int) ([]*domain.DiscoveryRunResponse, error)
}

type discoveryService struct {
	endpointRepo repository.EndpointRepository
	projectRepo  repository.ProjectRepository
	parser       *discovery.OpenAPIParser
}

// NewDiscoveryService instantiates a DiscoveryService.
func NewDiscoveryService(
	endpointRepo repository.EndpointRepository,
	projectRepo repository.ProjectRepository,
	parser *discovery.OpenAPIParser,
) DiscoveryService {
	return &discoveryService{
		endpointRepo: endpointRepo,
		projectRepo:  projectRepo,
		parser:       parser,
	}
}

func (s *discoveryService) ImportOpenAPI(ctx context.Context, projectID string, specBytes []byte, specURL string) (*domain.DiscoveryRunResponse, error) {
	now := time.Now().UTC()
	run := &domain.DiscoveryRun{
		ProjectID: projectID,
		Source:    domain.SourceOpenAPI,
		Status:    domain.RunStatusRunning,
		StartedAt: now,
		Metadata: domain.JSONMap{
			"url": specURL,
		},
	}

	if err := s.endpointRepo.CreateDiscoveryRun(ctx, run); err != nil {
		return nil, err
	}

	var routes []discovery.DiscoveredRoute
	var serviceName string
	var parseErr error

	if specURL != "" {
		routes, serviceName, parseErr = s.parser.FetchAndParseURL(ctx, specURL)
	} else {
		routes, serviceName, parseErr = s.parser.ParseBytes(specBytes)
	}

	if parseErr != nil {
		finishTime := time.Now().UTC()
		run.Status = domain.RunStatusFailed
		run.Error = parseErr.Error()
		run.FinishedAt = &finishTime
		_ = s.endpointRepo.UpdateDiscoveryRun(ctx, run)
		return nil, parseErr
	}

	run.Found = len(routes)
	createdCount := 0
	updatedCount := 0

	for _, r := range routes {
		meta := domain.JSONMap{
			"service":      serviceName,
			"operation_id": r.OperationID,
			"summary":      r.Summary,
		}
		_, created, err := s.endpointRepo.UpsertRoute(ctx, projectID, r, domain.SourceOpenAPI, meta)
		if err != nil {
			finishTime := time.Now().UTC()
			run.Status = domain.RunStatusFailed
			run.Error = err.Error()
			run.FinishedAt = &finishTime
			_ = s.endpointRepo.UpdateDiscoveryRun(ctx, run)
			return nil, err
		}

		if created {
			createdCount++
		} else {
			updatedCount++
		}
	}

	finishTime := time.Now().UTC()
	run.Status = domain.RunStatusCompleted
	run.Created = createdCount
	run.Updated = updatedCount
	run.FinishedAt = &finishTime

	if err := s.endpointRepo.UpdateDiscoveryRun(ctx, run); err != nil {
		return nil, err
	}

	return domain.ToDiscoveryRunResponse(run), nil
}

func (s *discoveryService) ImportManifest(ctx context.Context, projectID string, manifest *domain.DiscoveryManifest) (*domain.DiscoveryRunResponse, error) {
	routes, err := discovery.ParseManifest(manifest)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	run := &domain.DiscoveryRun{
		ProjectID: projectID,
		Source:    manifest.Source,
		Status:    domain.RunStatusRunning,
		StartedAt: now,
		Metadata: domain.JSONMap{
			"service": manifest.Service,
			"commit":  manifest.Commit,
			"branch":  manifest.Branch,
			"repo":    manifest.Repo,
		},
	}

	if err := s.endpointRepo.CreateDiscoveryRun(ctx, run); err != nil {
		return nil, err
	}

	run.Found = len(routes)
	createdCount := 0
	updatedCount := 0

	for _, r := range routes {
		meta := domain.JSONMap{
			"service": manifest.Service,
			"commit":  manifest.Commit,
			"repo":    manifest.Repo,
		}
		_, created, err := s.endpointRepo.UpsertRoute(ctx, projectID, r, manifest.Source, meta)
		if err != nil {
			finishTime := time.Now().UTC()
			run.Status = domain.RunStatusFailed
			run.Error = err.Error()
			run.FinishedAt = &finishTime
			_ = s.endpointRepo.UpdateDiscoveryRun(ctx, run)
			return nil, err
		}

		if created {
			createdCount++
		} else {
			updatedCount++
		}
	}

	finishTime := time.Now().UTC()
	run.Status = domain.RunStatusCompleted
	run.Created = createdCount
	run.Updated = updatedCount
	run.FinishedAt = &finishTime

	if err := s.endpointRepo.UpdateDiscoveryRun(ctx, run); err != nil {
		return nil, err
	}

	return domain.ToDiscoveryRunResponse(run), nil
}

func (s *discoveryService) GetDiscoveryRun(ctx context.Context, projectID, runID string) (*domain.DiscoveryRunResponse, error) {
	run, err := s.endpointRepo.FindDiscoveryRunByID(ctx, projectID, runID)
	if err != nil {
		return nil, err
	}
	return domain.ToDiscoveryRunResponse(run), nil
}

func (s *discoveryService) ListDiscoveryRuns(ctx context.Context, projectID string, limit int) ([]*domain.DiscoveryRunResponse, error) {
	runs, err := s.endpointRepo.ListDiscoveryRuns(ctx, projectID, limit)
	if err != nil {
		return nil, err
	}

	res := make([]*domain.DiscoveryRunResponse, 0, len(runs))
	for _, r := range runs {
		res = append(res, domain.ToDiscoveryRunResponse(r))
	}
	return res, nil
}
