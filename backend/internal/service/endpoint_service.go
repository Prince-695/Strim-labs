package service

import (
	"context"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// EndpointService provides business operations for querying and managing API registry endpoints.
type EndpointService interface {
	ListEndpoints(ctx context.Context, projectID string, query domain.ListEndpointsQuery) ([]*domain.EndpointResponse, *domain.PageMeta, error)
	GetEndpoint(ctx context.Context, projectID, endpointID string) (*domain.EndpointDetailResponse, error)
	PatchEndpoint(ctx context.Context, projectID, endpointID string, req domain.PatchEndpointRequest) (*domain.EndpointResponse, error)
}

type endpointService struct {
	endpointRepo repository.EndpointRepository
	projectRepo  repository.ProjectRepository
}

// NewEndpointService instantiates an EndpointService.
func NewEndpointService(
	endpointRepo repository.EndpointRepository,
	projectRepo repository.ProjectRepository,
) EndpointService {
	return &endpointService{
		endpointRepo: endpointRepo,
		projectRepo:  projectRepo,
	}
}

func (s *endpointService) ListEndpoints(ctx context.Context, projectID string, query domain.ListEndpointsQuery) ([]*domain.EndpointResponse, *domain.PageMeta, error) {
	endpoints, nextCursor, err := s.endpointRepo.List(ctx, projectID, query)
	if err != nil {
		return nil, nil, err
	}

	res := make([]*domain.EndpointResponse, 0, len(endpoints))
	for _, ep := range endpoints {
		res = append(res, domain.ToEndpointResponse(ep))
	}

	limit := query.Limit
	if limit <= 0 {
		limit = 50
	}
	hasMore := nextCursor != ""

	meta := &domain.PageMeta{
		Limit:      limit,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}

	return res, meta, nil
}

func (s *endpointService) GetEndpoint(ctx context.Context, projectID, endpointID string) (*domain.EndpointDetailResponse, error) {
	ep, err := s.endpointRepo.FindByID(ctx, projectID, endpointID)
	if err != nil {
		return nil, err
	}

	base := domain.ToEndpointResponse(ep)

	sourcesDetail := make([]domain.EndpointSourceDetail, 0, len(ep.Sources))
	for _, src := range ep.Sources {
		sourcesDetail = append(sourcesDetail, domain.EndpointSourceDetail{
			Source:    src.Source,
			FirstSeen: src.FirstSeen,
			LastSeen:  src.LastSeen,
			Metadata:  src.Metadata,
		})
	}

	return &domain.EndpointDetailResponse{
		EndpointResponse: *base,
		SourcesDetail:    sourcesDetail,
		Stats24h: domain.StatsSummary{
			Requests:  0,
			RPS:       0,
			P95Ms:     0,
			ErrorRate: 0,
		},
	}, nil
}

func (s *endpointService) PatchEndpoint(ctx context.Context, projectID, endpointID string, req domain.PatchEndpointRequest) (*domain.EndpointResponse, error) {
	ep, err := s.endpointRepo.FindByID(ctx, projectID, endpointID)
	if err != nil {
		return nil, err
	}

	if req.Status != nil {
		targetStatus := *req.Status
		if targetStatus != domain.EndpointStatusActive && targetStatus != domain.EndpointStatusIgnored {
			return nil, domain.NewBadRequestError("Users can only toggle status between 'active' and 'ignored'", nil)
		}
		ep.Status = targetStatus
	}

	if req.Tags != nil {
		ep.Tags = domain.StringSlice(*req.Tags)
	}

	if req.Note != nil {
		ep.Note = *req.Note
	}

	if err := s.endpointRepo.Update(ctx, projectID, ep); err != nil {
		return nil, err
	}

	return domain.ToEndpointResponse(ep), nil
}
