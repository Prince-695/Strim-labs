package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// AlertService manages the CRUD lifecycle and muting of alerting policies.
type AlertService interface {
	CreateRule(ctx context.Context, projectID string, req domain.CreateAlertRuleRequest) (*domain.AlertRuleResponse, error)
	GetRule(ctx context.Context, projectID, ruleID string) (*domain.AlertRuleResponse, error)
	UpdateRule(ctx context.Context, projectID, ruleID string, req domain.UpdateAlertRuleRequest) (*domain.AlertRuleResponse, error)
	DeleteRule(ctx context.Context, projectID, ruleID string) error
	MuteRule(ctx context.Context, projectID, ruleID string, minutes int) (*domain.AlertRuleResponse, error)
	ListRules(ctx context.Context, projectID string) (*domain.ListAlertRulesResponse, error)
}

type alertService struct {
	alertRepo    repository.AlertRuleRepository
	projectRepo  repository.ProjectRepository
	endpointRepo repository.EndpointRepository
	channelRepo  repository.NotificationChannelRepository
	clock        clock.Clock
	idGen        ids.IDGenerator
}

// NewAlertService creates a new AlertService.
func NewAlertService(
	alertRepo repository.AlertRuleRepository,
	projectRepo repository.ProjectRepository,
	endpointRepo repository.EndpointRepository,
	channelRepo repository.NotificationChannelRepository,
	clk clock.Clock,
	idGen ids.IDGenerator,
) AlertService {
	if clk == nil {
		clk = clock.NewRealClock()
	}
	if idGen == nil {
		idGen = ids.NewUUIDv7Generator()
	}
	return &alertService{
		alertRepo:    alertRepo,
		projectRepo:  projectRepo,
		endpointRepo: endpointRepo,
		channelRepo:  channelRepo,
		clock:        clk,
		idGen:        idGen,
	}
}

func (s *alertService) CreateRule(ctx context.Context, projectID string, req domain.CreateAlertRuleRequest) (*domain.AlertRuleResponse, error) {
	proj, err := s.projectRepo.FindOnlyByID(ctx, projectID)
	if err != nil || proj == nil {
		return nil, domain.NewProjectNotFoundError()
	}

	if err := validateRuleCondition(req.Condition); err != nil {
		return nil, err
	}

	if err := s.validateRuleScope(ctx, projectID, req.Scope); err != nil {
		return nil, err
	}

	if err := s.validateChannelIDs(ctx, projectID, req.ChannelIDs); err != nil {
		return nil, err
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	scopeJSON, _ := toJSONMap(req.Scope)
	condJSON, _ := toJSONMap(req.Condition)
	now := s.clock.Now().UTC()

	rule := &domain.AlertRule{
		ID:          s.idGen.MustNewUUIDv7(),
		OrgID:       proj.OrgID,
		ProjectID:   projectID,
		Name:        strings.TrimSpace(req.Name),
		Description: strings.TrimSpace(req.Description),
		Enabled:     enabled,
		Version:     1,
		Scope:       scopeJSON,
		Condition:   condJSON,
		Severity:    req.Severity,
		ChannelIDs:  domain.ChannelIDsToJSONMap(req.ChannelIDs),
		State:       domain.AlertStateOK,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.alertRepo.Create(ctx, rule); err != nil {
		return nil, domain.NewInternalError(err)
	}

	resp := domain.ToAlertRuleResponse(rule)
	return &resp, nil
}

func (s *alertService) GetRule(ctx context.Context, projectID, ruleID string) (*domain.AlertRuleResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	rule, err := s.alertRepo.FindByID(ctx, projectID, ruleID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if rule == nil {
		return nil, domain.NewAlertRuleNotFoundError()
	}

	resp := domain.ToAlertRuleResponse(rule)
	return &resp, nil
}

func (s *alertService) UpdateRule(ctx context.Context, projectID, ruleID string, req domain.UpdateAlertRuleRequest) (*domain.AlertRuleResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	existing, err := s.alertRepo.FindByID(ctx, projectID, ruleID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if existing == nil {
		return nil, domain.NewAlertRuleNotFoundError()
	}

	if req.Name != nil {
		existing.Name = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		existing.Description = strings.TrimSpace(*req.Description)
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	if req.Severity != nil {
		existing.Severity = *req.Severity
	}
	if req.Scope != nil {
		if err := s.validateRuleScope(ctx, projectID, *req.Scope); err != nil {
			return nil, err
		}
		scopeJSON, _ := toJSONMap(*req.Scope)
		existing.Scope = scopeJSON
	}
	if req.Condition != nil {
		if err := validateRuleCondition(*req.Condition); err != nil {
			return nil, err
		}
		condJSON, _ := toJSONMap(*req.Condition)
		existing.Condition = condJSON
	}
	if req.ChannelIDs != nil {
		if err := s.validateChannelIDs(ctx, projectID, *req.ChannelIDs); err != nil {
			return nil, err
		}
		existing.ChannelIDs = domain.ChannelIDsToJSONMap(*req.ChannelIDs)
	}

	if err := s.alertRepo.Update(ctx, existing, req.Version); err != nil {
		return nil, err
	}

	resp := domain.ToAlertRuleResponse(existing)
	return &resp, nil
}

func (s *alertService) DeleteRule(ctx context.Context, projectID, ruleID string) error {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return domain.NewProjectNotFoundError()
	}
	return s.alertRepo.Delete(ctx, projectID, ruleID)
}

func (s *alertService) MuteRule(ctx context.Context, projectID, ruleID string, minutes int) (*domain.AlertRuleResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	if minutes < 1 || minutes > 10080 {
		return nil, domain.NewValidationError("mute duration must be between 1 and 10080 minutes", nil)
	}

	mutedUntil := s.clock.Now().UTC().Add(time.Duration(minutes) * time.Minute)
	if err := s.alertRepo.Mute(ctx, projectID, ruleID, mutedUntil); err != nil {
		return nil, err
	}

	return s.GetRule(ctx, projectID, ruleID)
}

func (s *alertService) ListRules(ctx context.Context, projectID string) (*domain.ListAlertRulesResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	rules, err := s.alertRepo.ListByProject(ctx, projectID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	items := make([]domain.AlertRuleResponse, len(rules))
	for i, r := range rules {
		items[i] = domain.ToAlertRuleResponse(r)
	}

	return &domain.ListAlertRulesResponse{
		Rules: items,
		Total: len(items),
	}, nil
}

func validateRuleCondition(cond domain.AlertCondition) error {
	validMetrics := map[string]bool{
		"error_rate":  true,
		"latency_p95": true,
		"latency_p99": true,
		"rps":         true,
	}
	if !validMetrics[strings.ToLower(strings.TrimSpace(cond.Metric))] {
		return domain.NewValidationError("condition metric must be one of: error_rate, latency_p95, latency_p99, rps", nil)
	}

	validOps := map[string]bool{">": true, ">=": true, "<": true, "<=": true}
	if !validOps[strings.TrimSpace(cond.Operator)] {
		return domain.NewValidationError("condition operator must be one of: >, >=, <, <=", nil)
	}

	if cond.Threshold < 0 {
		return domain.NewValidationError("condition threshold must be non-negative", nil)
	}

	if cond.Window != "" {
		if _, err := time.ParseDuration(cond.Window); err != nil {
			return domain.NewValidationError("invalid condition window duration format (e.g. 1m, 5m, 15m)", nil)
		}
	}

	if cond.For != "" {
		if _, err := time.ParseDuration(cond.For); err != nil {
			return domain.NewValidationError("invalid condition for duration format (e.g. 0m, 1m, 2m)", nil)
		}
	}

	return nil
}

func (s *alertService) validateRuleScope(ctx context.Context, projectID string, scope domain.AlertScope) error {
	if scope.Type != domain.AlertScopeProject && scope.Type != domain.AlertScopeEndpoint {
		return domain.NewValidationError("scope type must be 'project' or 'endpoint'", nil)
	}

	if scope.Type == domain.AlertScopeEndpoint {
		if scope.EndpointID == nil || strings.TrimSpace(*scope.EndpointID) == "" {
			return domain.NewValidationError("endpoint_id is required when scope type is 'endpoint'", nil)
		}
		ep, err := s.endpointRepo.FindByID(ctx, projectID, *scope.EndpointID)
		if err != nil || ep == nil {
			return domain.NewEndpointNotFoundError()
		}
	}

	return nil
}

func (s *alertService) validateChannelIDs(ctx context.Context, projectID string, channelIDs []string) error {
	for _, chID := range channelIDs {
		ch, err := s.channelRepo.FindByID(ctx, projectID, chID)
		if err != nil || ch == nil {
			return domain.NewValidationError(fmt.Sprintf("notification channel '%s' not found in this project", chID), nil)
		}
	}
	return nil
}

func toJSONMap(v interface{}) (domain.JSONMap, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var m domain.JSONMap
	err = json.Unmarshal(b, &m)
	return m, err
}
