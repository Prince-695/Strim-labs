package service

import (
	"context"
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// IncidentService manages incident triage, acknowledgement, manual resolution, and comments.
type IncidentService interface {
	ListIncidents(ctx context.Context, projectID string, query domain.ListIncidentsQuery) (*domain.ListIncidentsResponse, error)
	GetIncident(ctx context.Context, projectID, incidentID string) (*domain.IncidentDetailResponse, error)
	AcknowledgeIncident(ctx context.Context, projectID, incidentID, userEmail string) (*domain.IncidentDetailResponse, error)
	ResolveIncident(ctx context.Context, projectID, incidentID, userEmail string) (*domain.IncidentDetailResponse, error)
	AddComment(ctx context.Context, projectID, incidentID, userEmail string, req domain.AddIncidentCommentRequest) (*domain.IncidentTimelineItem, error)
}

type incidentService struct {
	incidentRepo repository.IncidentRepository
	projectRepo  repository.ProjectRepository
	clock        clock.Clock
	idGen        ids.IDGenerator
}

// NewIncidentService creates a new IncidentService.
func NewIncidentService(
	incidentRepo repository.IncidentRepository,
	projectRepo repository.ProjectRepository,
	clk clock.Clock,
	idGen ids.IDGenerator,
) IncidentService {
	if clk == nil {
		clk = clock.NewRealClock()
	}
	if idGen == nil {
		idGen = ids.NewUUIDv7Generator()
	}
	return &incidentService{
		incidentRepo: incidentRepo,
		projectRepo:  projectRepo,
		clock:        clk,
		idGen:        idGen,
	}
}

func (s *incidentService) ListIncidents(ctx context.Context, projectID string, query domain.ListIncidentsQuery) (*domain.ListIncidentsResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	incidents, total, err := s.incidentRepo.ListByProject(ctx, projectID, query)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	items := make([]domain.IncidentResponse, len(incidents))
	for i, inc := range incidents {
		items[i] = domain.ToIncidentResponse(inc)
	}

	return &domain.ListIncidentsResponse{
		Incidents: items,
		Total:     total,
	}, nil
}

func (s *incidentService) GetIncident(ctx context.Context, projectID, incidentID string) (*domain.IncidentDetailResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	inc, err := s.incidentRepo.FindByID(ctx, projectID, incidentID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if inc == nil {
		return nil, domain.NewIncidentNotFoundError()
	}

	timelineEvents, err := s.incidentRepo.GetTimeline(ctx, incidentID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	timeline := make([]domain.IncidentTimelineItem, len(timelineEvents))
	for i, e := range timelineEvents {
		timeline[i] = domain.IncidentTimelineItem{
			ID:     e.ID,
			Type:   e.Type,
			Actor:  e.Actor,
			Detail: e.Detail,
			At:     e.At,
		}
	}

	return &domain.IncidentDetailResponse{
		IncidentResponse: domain.ToIncidentResponse(inc),
		Timeline:         timeline,
	}, nil
}

func (s *incidentService) AcknowledgeIncident(ctx context.Context, projectID, incidentID, userEmail string) (*domain.IncidentDetailResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	inc, err := s.incidentRepo.FindByID(ctx, projectID, incidentID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if inc == nil {
		return nil, domain.NewIncidentNotFoundError()
	}

	if inc.Status != domain.IncidentStatusOpen {
		return nil, domain.NewValidationError("only open incidents can be acknowledged", nil)
	}

	now := s.clock.Now().UTC()
	if err := s.incidentRepo.UpdateStatus(ctx, projectID, incidentID, domain.IncidentStatusAcknowledged, &userEmail, now, false); err != nil {
		return nil, domain.NewInternalError(err)
	}

	// Add timeline event
	_ = s.incidentRepo.AddEvent(ctx, &domain.IncidentEvent{
		ID:         s.idGen.MustNewUUIDv7(),
		IncidentID: incidentID,
		Type:       domain.IncidentEventAcknowledged,
		Actor:      userEmail,
		Detail:     "Incident acknowledged by oncall responder",
		At:         now,
	})

	return s.GetIncident(ctx, projectID, incidentID)
}

func (s *incidentService) ResolveIncident(ctx context.Context, projectID, incidentID, userEmail string) (*domain.IncidentDetailResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	inc, err := s.incidentRepo.FindByID(ctx, projectID, incidentID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if inc == nil {
		return nil, domain.NewIncidentNotFoundError()
	}

	if inc.Status == domain.IncidentStatusResolved {
		return nil, domain.NewValidationError("incident is already resolved", nil)
	}

	now := s.clock.Now().UTC()
	if err := s.incidentRepo.UpdateStatus(ctx, projectID, incidentID, domain.IncidentStatusResolved, &userEmail, now, false); err != nil {
		return nil, domain.NewInternalError(err)
	}

	// Add timeline event
	_ = s.incidentRepo.AddEvent(ctx, &domain.IncidentEvent{
		ID:         s.idGen.MustNewUUIDv7(),
		IncidentID: incidentID,
		Type:       domain.IncidentEventResolved,
		Actor:      userEmail,
		Detail:     "Incident manually resolved",
		At:         now,
	})

	return s.GetIncident(ctx, projectID, incidentID)
}

func (s *incidentService) AddComment(ctx context.Context, projectID, incidentID, userEmail string, req domain.AddIncidentCommentRequest) (*domain.IncidentTimelineItem, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	inc, err := s.incidentRepo.FindByID(ctx, projectID, incidentID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if inc == nil {
		return nil, domain.NewIncidentNotFoundError()
	}

	body := strings.TrimSpace(req.Body)
	if body == "" {
		return nil, domain.NewValidationError("comment body cannot be empty", nil)
	}

	now := s.clock.Now().UTC()
	ev := &domain.IncidentEvent{
		ID:         s.idGen.MustNewUUIDv7(),
		IncidentID: incidentID,
		Type:       domain.IncidentEventComment,
		Actor:      userEmail,
		Detail:     body,
		At:         now,
	}

	if err := s.incidentRepo.AddEvent(ctx, ev); err != nil {
		return nil, domain.NewInternalError(err)
	}

	return &domain.IncidentTimelineItem{
		ID:     ev.ID,
		Type:   ev.Type,
		Actor:  ev.Actor,
		Detail: ev.Detail,
		At:     ev.At,
	}, nil
}
