package service

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/notify"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// NotificationService manages notification channel destinations and verification test dispatches.
type NotificationService interface {
	CreateChannel(ctx context.Context, projectID string, req domain.CreateChannelRequest) (*domain.ChannelResponse, error)
	GetChannel(ctx context.Context, projectID, channelID string) (*domain.ChannelResponse, error)
	UpdateChannel(ctx context.Context, projectID, channelID string, req domain.UpdateChannelRequest) (*domain.ChannelResponse, error)
	DeleteChannel(ctx context.Context, projectID, channelID string) error
	ListChannels(ctx context.Context, projectID string) (*domain.ListChannelsResponse, error)
	TestChannel(ctx context.Context, projectID, channelID string) (*domain.TestChannelResponse, error)
}

type notificationService struct {
	channelRepo repository.NotificationChannelRepository
	projectRepo repository.ProjectRepository
	dispatcher  notify.Dispatcher
	ssrfGuard   *netguard.SSRFGuard
	clock       clock.Clock
	idGen       ids.IDGenerator
}

// NewNotificationService creates a new NotificationService instance.
func NewNotificationService(
	channelRepo repository.NotificationChannelRepository,
	projectRepo repository.ProjectRepository,
	dispatcher notify.Dispatcher,
	ssrfGuard *netguard.SSRFGuard,
	clk clock.Clock,
	idGen ids.IDGenerator,
) NotificationService {
	if clk == nil {
		clk = clock.NewRealClock()
	}
	if idGen == nil {
		idGen = ids.NewUUIDv7Generator()
	}
	return &notificationService{
		channelRepo: channelRepo,
		projectRepo: projectRepo,
		dispatcher:  dispatcher,
		ssrfGuard:   ssrfGuard,
		clock:       clk,
		idGen:       idGen,
	}
}

func (s *notificationService) CreateChannel(ctx context.Context, projectID string, req domain.CreateChannelRequest) (*domain.ChannelResponse, error) {
	proj, err := s.projectRepo.FindOnlyByID(ctx, projectID)
	if err != nil || proj == nil {
		return nil, domain.NewProjectNotFoundError()
	}

	if err := s.validateChannelConfig(ctx, req.Type, req.Config); err != nil {
		return nil, err
	}

	now := s.clock.Now().UTC()
	channel := &domain.NotificationChannel{
		ID:        s.idGen.MustNewUUIDv7(),
		OrgID:     proj.OrgID,
		ProjectID: projectID,
		Type:      req.Type,
		Name:      strings.TrimSpace(req.Name),
		Config:    req.Config,
		Enabled:   true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.channelRepo.Create(ctx, channel); err != nil {
		return nil, domain.NewInternalError(err)
	}

	resp := domain.ToChannelResponse(channel)
	return &resp, nil
}

func (s *notificationService) GetChannel(ctx context.Context, projectID, channelID string) (*domain.ChannelResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	ch, err := s.channelRepo.FindByID(ctx, projectID, channelID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if ch == nil {
		return nil, domain.NewChannelNotFoundError()
	}

	resp := domain.ToChannelResponse(ch)
	return &resp, nil
}

func (s *notificationService) UpdateChannel(ctx context.Context, projectID, channelID string, req domain.UpdateChannelRequest) (*domain.ChannelResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	ch, err := s.channelRepo.FindByID(ctx, projectID, channelID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if ch == nil {
		return nil, domain.NewChannelNotFoundError()
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if len(name) < 2 || len(name) > 128 {
			return nil, domain.NewValidationError("channel name must be between 2 and 128 characters", nil)
		}
		ch.Name = name
	}

	if req.Enabled != nil {
		ch.Enabled = *req.Enabled
	}

	if req.Config != nil {
		if err := s.validateChannelConfig(ctx, ch.Type, *req.Config); err != nil {
			return nil, err
		}
		ch.Config = *req.Config
	}

	if err := s.channelRepo.Update(ctx, ch); err != nil {
		return nil, domain.NewInternalError(err)
	}

	resp := domain.ToChannelResponse(ch)
	return &resp, nil
}

func (s *notificationService) DeleteChannel(ctx context.Context, projectID, channelID string) error {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return domain.NewProjectNotFoundError()
	}
	return s.channelRepo.Delete(ctx, projectID, channelID)
}

func (s *notificationService) ListChannels(ctx context.Context, projectID string) (*domain.ListChannelsResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	channels, err := s.channelRepo.ListByProject(ctx, projectID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	items := make([]domain.ChannelResponse, len(channels))
	for i, ch := range channels {
		items[i] = domain.ToChannelResponse(ch)
	}

	return &domain.ListChannelsResponse{
		Channels: items,
		Total:    len(items),
	}, nil
}

func (s *notificationService) TestChannel(ctx context.Context, projectID, channelID string) (*domain.TestChannelResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	ch, err := s.channelRepo.FindByID(ctx, projectID, channelID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if ch == nil {
		return nil, domain.NewChannelNotFoundError()
	}

	if s.dispatcher == nil {
		return nil, domain.NewInternalError(fmt.Errorf("dispatcher not initialized"))
	}

	dispatchErr := s.dispatcher.TestSend(ctx, ch)
	status := "success"
	errMsg := ""
	if dispatchErr != nil {
		status = "failed"
		errMsg = dispatchErr.Error()
	}

	_ = s.channelRepo.LogDispatch(ctx, &domain.NotificationLog{
		ID:         s.idGen.MustNewUUIDv7(),
		ChannelID:  ch.ID,
		IncidentID: "test-dispatch",
		Type:       ch.Type,
		Status:     status,
		Error:      errMsg,
		SentAt:     s.clock.Now().UTC(),
	})

	if dispatchErr != nil {
		return &domain.TestChannelResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to send test notification: %s", dispatchErr.Error()),
			Details: domain.JSONMap{"error": dispatchErr.Error()},
		}, nil
	}

	return &domain.TestChannelResponse{
		Success: true,
		Message: "Test notification dispatched successfully",
		Details: domain.JSONMap{"channel_type": string(ch.Type)},
	}, nil
}

func (s *notificationService) validateChannelConfig(ctx context.Context, chType domain.ChannelType, cfg domain.JSONMap) error {
	switch chType {
	case domain.ChannelTypeSlack:
		rawURL, ok := cfg["webhook_url"].(string)
		if !ok || strings.TrimSpace(rawURL) == "" {
			return domain.NewValidationError("slack channel requires 'webhook_url'", nil)
		}
		u, err := url.ParseRequestURI(rawURL)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			return domain.NewValidationError("invalid webhook_url; must be valid HTTP/HTTPS URL", nil)
		}
		if s.ssrfGuard != nil {
			if _, err := s.ssrfGuard.ValidateTargetURL(ctx, rawURL); err != nil {
				return domain.NewValidationError(fmt.Sprintf("webhook_url blocked by SSRF guard: %s", err.Error()), nil)
			}
		}

	case domain.ChannelTypeEmail:
		addresses, ok := cfg["addresses"].([]interface{})
		if !ok || len(addresses) == 0 {
			return domain.NewValidationError("email channel requires at least one address in 'addresses'", nil)
		}
		for _, a := range addresses {
			str, ok := a.(string)
			if !ok || !strings.Contains(str, "@") {
				return domain.NewValidationError(fmt.Sprintf("invalid email address: %v", a), nil)
			}
		}

	case domain.ChannelTypeWebhook:
		rawURL, ok := cfg["url"].(string)
		if !ok || strings.TrimSpace(rawURL) == "" {
			return domain.NewValidationError("generic webhook requires 'url'", nil)
		}
		u, err := url.ParseRequestURI(rawURL)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			return domain.NewValidationError("invalid url; must be valid HTTP/HTTPS URL", nil)
		}
		if s.ssrfGuard != nil {
			if _, err := s.ssrfGuard.ValidateTargetURL(ctx, rawURL); err != nil {
				return domain.NewValidationError(fmt.Sprintf("webhook url blocked by SSRF guard: %s", err.Error()), nil)
			}
		}

	default:
		return domain.NewValidationError("unsupported channel type; must be slack, email, or webhook", nil)
	}

	return nil
}
