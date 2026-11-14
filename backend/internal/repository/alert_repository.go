package repository

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"gorm.io/gorm"
)

// AlertRuleRepository defines data persistence operations for alert rules.
type AlertRuleRepository interface {
	Create(ctx context.Context, rule *domain.AlertRule) error
	FindByID(ctx context.Context, projectID, ruleID string) (*domain.AlertRule, error)
	Update(ctx context.Context, rule *domain.AlertRule, expectedVersion int) error
	UpdateState(ctx context.Context, ruleID string, state domain.AlertState, pendingSince *time.Time, lastEvaluatedAt, lastTriggeredAt *time.Time) error
	Mute(ctx context.Context, projectID, ruleID string, mutedUntil time.Time) error
	Delete(ctx context.Context, projectID, ruleID string) error
	ListByProject(ctx context.Context, projectID string) ([]*domain.AlertRule, error)
	ListActiveRules(ctx context.Context) ([]*domain.AlertRule, error)
}

// IncidentRepository defines data persistence operations for incidents and timelines.
type IncidentRepository interface {
	Create(ctx context.Context, incident *domain.Incident) error
	FindByID(ctx context.Context, projectID, incidentID string) (*domain.Incident, error)
	FindOpenByRuleID(ctx context.Context, projectID, ruleID string) (*domain.Incident, error)
	UpdateStatus(ctx context.Context, projectID, incidentID string, status domain.IncidentStatus, by *string, at time.Time, autoResolved bool) error
	AddEvent(ctx context.Context, event *domain.IncidentEvent) error
	GetTimeline(ctx context.Context, incidentID string) ([]*domain.IncidentEvent, error)
	ListByProject(ctx context.Context, projectID string, query domain.ListIncidentsQuery) ([]*domain.Incident, int, error)
}

// NotificationChannelRepository defines data persistence operations for alerting destinations.
type NotificationChannelRepository interface {
	Create(ctx context.Context, channel *domain.NotificationChannel) error
	FindByID(ctx context.Context, projectID, channelID string) (*domain.NotificationChannel, error)
	Update(ctx context.Context, channel *domain.NotificationChannel) error
	Delete(ctx context.Context, projectID, channelID string) error
	ListByProject(ctx context.Context, projectID string) ([]*domain.NotificationChannel, error)
	LogDispatch(ctx context.Context, log *domain.NotificationLog) error
}

// --- GORM Implementations ---

type GormAlertRuleRepository struct {
	db *database.DB
}

func NewAlertRuleRepository(db *database.DB) *GormAlertRuleRepository {
	return &GormAlertRuleRepository{db: db}
}

func (r *GormAlertRuleRepository) Create(ctx context.Context, rule *domain.AlertRule) error {
	return r.db.WithContext(ctx).Create(rule).Error
}

func (r *GormAlertRuleRepository) FindByID(ctx context.Context, projectID, ruleID string) (*domain.AlertRule, error) {
	var rule domain.AlertRule
	err := r.db.WithContext(ctx).Where("id = ? AND project_id = ?", ruleID, projectID).First(&rule).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

func (r *GormAlertRuleRepository) Update(ctx context.Context, rule *domain.AlertRule, expectedVersion int) error {
	res := r.db.WithContext(ctx).
		Model(&domain.AlertRule{}).
		Where("id = ? AND project_id = ? AND version = ?", rule.ID, rule.ProjectID, expectedVersion).
		Updates(map[string]interface{}{
			"name":        rule.Name,
			"description": rule.Description,
			"enabled":     rule.Enabled,
			"version":     expectedVersion + 1,
			"scope":       rule.Scope,
			"condition":   rule.Condition,
			"severity":    rule.Severity,
			"channel_ids": rule.ChannelIDs,
			"updated_at":  time.Now().UTC(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		var count int64
		_ = r.db.WithContext(ctx).Model(&domain.AlertRule{}).Where("id = ? AND project_id = ?", rule.ID, rule.ProjectID).Count(&count).Error
		if count == 0 {
			return domain.NewAlertRuleNotFoundError()
		}
		return domain.NewVersionConflictError()
	}
	rule.Version = expectedVersion + 1
	return nil
}

func (r *GormAlertRuleRepository) UpdateState(ctx context.Context, ruleID string, state domain.AlertState, pendingSince *time.Time, lastEvaluatedAt, lastTriggeredAt *time.Time) error {
	updates := map[string]interface{}{
		"state":             state,
		"pending_since":     pendingSince,
		"last_evaluated_at": lastEvaluatedAt,
		"updated_at":        time.Now().UTC(),
	}
	if lastTriggeredAt != nil {
		updates["last_triggered_at"] = lastTriggeredAt
	}
	return r.db.WithContext(ctx).Model(&domain.AlertRule{}).Where("id = ?", ruleID).Updates(updates).Error
}

func (r *GormAlertRuleRepository) Mute(ctx context.Context, projectID, ruleID string, mutedUntil time.Time) error {
	res := r.db.WithContext(ctx).Model(&domain.AlertRule{}).
		Where("id = ? AND project_id = ?", ruleID, projectID).
		Updates(map[string]interface{}{
			"state":       domain.AlertStateMuted,
			"muted_until": mutedUntil,
			"updated_at":  time.Now().UTC(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.NewAlertRuleNotFoundError()
	}
	return nil
}

func (r *GormAlertRuleRepository) Delete(ctx context.Context, projectID, ruleID string) error {
	res := r.db.WithContext(ctx).Where("id = ? AND project_id = ?", ruleID, projectID).Delete(&domain.AlertRule{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.NewAlertRuleNotFoundError()
	}
	return nil
}

func (r *GormAlertRuleRepository) ListByProject(ctx context.Context, projectID string) ([]*domain.AlertRule, error) {
	var rules []*domain.AlertRule
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		Find(&rules).Error
	if err != nil {
		return nil, err
	}
	return rules, nil
}

func (r *GormAlertRuleRepository) ListActiveRules(ctx context.Context) ([]*domain.AlertRule, error) {
	var rules []*domain.AlertRule
	err := r.db.WithContext(ctx).
		Where("enabled = ?", true).
		Find(&rules).Error
	if err != nil {
		return nil, err
	}
	return rules, nil
}

type GormIncidentRepository struct {
	db *database.DB
}

func NewIncidentRepository(db *database.DB) *GormIncidentRepository {
	return &GormIncidentRepository{db: db}
}

func (r *GormIncidentRepository) Create(ctx context.Context, incident *domain.Incident) error {
	return r.db.WithContext(ctx).Create(incident).Error
}

func (r *GormIncidentRepository) FindByID(ctx context.Context, projectID, incidentID string) (*domain.Incident, error) {
	var inc domain.Incident
	err := r.db.WithContext(ctx).Where("id = ? AND project_id = ?", incidentID, projectID).First(&inc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &inc, nil
}

func (r *GormIncidentRepository) FindOpenByRuleID(ctx context.Context, projectID, ruleID string) (*domain.Incident, error) {
	var inc domain.Incident
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND rule_id = ? AND status IN (?, ?)", projectID, ruleID, domain.IncidentStatusOpen, domain.IncidentStatusAcknowledged).
		Order("created_at DESC").
		First(&inc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &inc, nil
}

func (r *GormIncidentRepository) UpdateStatus(ctx context.Context, projectID, incidentID string, status domain.IncidentStatus, by *string, at time.Time, autoResolved bool) error {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now().UTC(),
	}
	if status == domain.IncidentStatusAcknowledged {
		updates["acknowledged_at"] = at
		updates["acknowledged_by"] = by
	} else if status == domain.IncidentStatusResolved {
		updates["resolved_at"] = at
		updates["resolved_by"] = by
		updates["auto_resolved"] = autoResolved
	}

	res := r.db.WithContext(ctx).Model(&domain.Incident{}).Where("id = ? AND project_id = ?", incidentID, projectID).Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.NewIncidentNotFoundError()
	}
	return nil
}

func (r *GormIncidentRepository) AddEvent(ctx context.Context, event *domain.IncidentEvent) error {
	return r.db.WithContext(ctx).Create(event).Error
}

func (r *GormIncidentRepository) GetTimeline(ctx context.Context, incidentID string) ([]*domain.IncidentEvent, error) {
	var events []*domain.IncidentEvent
	err := r.db.WithContext(ctx).Where("incident_id = ?", incidentID).Order("at ASC").Find(&events).Error
	if err != nil {
		return nil, err
	}
	return events, nil
}

func (r *GormIncidentRepository) ListByProject(ctx context.Context, projectID string, query domain.ListIncidentsQuery) ([]*domain.Incident, int, error) {
	tx := r.db.WithContext(ctx).Model(&domain.Incident{}).Where("project_id = ?", projectID)

	if query.Status != "" && query.Status != "all" {
		tx = tx.Where("status = ?", query.Status)
	}
	if query.Severity != "" {
		tx = tx.Where("severity = ?", query.Severity)
	}
	if query.Range != "" {
		dur := 24 * time.Hour
		switch strings.ToLower(query.Range) {
		case "15m":
			dur = 15 * time.Minute
		case "1h":
			dur = 1 * time.Hour
		case "6h":
			dur = 6 * time.Hour
		case "24h":
			dur = 24 * time.Hour
		case "7d":
			dur = 7 * 24 * time.Hour
		case "30d":
			dur = 30 * 24 * time.Hour
		}
		since := time.Now().UTC().Add(-dur)
		tx = tx.Where("created_at >= ?", since)
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	limit := query.Limit
	if limit <= 0 {
		limit = 20
	} else if limit > 100 {
		limit = 100
	}

	offset := query.Offset
	if offset < 0 {
		offset = 0
	}

	var incidents []*domain.Incident
	err := tx.Order("created_at DESC").Limit(limit).Offset(offset).Find(&incidents).Error
	if err != nil {
		return nil, 0, err
	}

	return incidents, int(total), nil
}

type GormNotificationChannelRepository struct {
	db *database.DB
}

func NewNotificationChannelRepository(db *database.DB) *GormNotificationChannelRepository {
	return &GormNotificationChannelRepository{db: db}
}

func (r *GormNotificationChannelRepository) Create(ctx context.Context, channel *domain.NotificationChannel) error {
	return r.db.WithContext(ctx).Create(channel).Error
}

func (r *GormNotificationChannelRepository) FindByID(ctx context.Context, projectID, channelID string) (*domain.NotificationChannel, error) {
	var ch domain.NotificationChannel
	err := r.db.WithContext(ctx).Where("id = ? AND project_id = ?", channelID, projectID).First(&ch).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &ch, nil
}

func (r *GormNotificationChannelRepository) Update(ctx context.Context, channel *domain.NotificationChannel) error {
	res := r.db.WithContext(ctx).Model(&domain.NotificationChannel{}).
		Where("id = ? AND project_id = ?", channel.ID, channel.ProjectID).
		Updates(map[string]interface{}{
			"name":       channel.Name,
			"config":     channel.Config,
			"enabled":    channel.Enabled,
			"updated_at": time.Now().UTC(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.NewChannelNotFoundError()
	}
	return nil
}

func (r *GormNotificationChannelRepository) Delete(ctx context.Context, projectID, channelID string) error {
	res := r.db.WithContext(ctx).Where("id = ? AND project_id = ?", channelID, projectID).Delete(&domain.NotificationChannel{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.NewChannelNotFoundError()
	}
	return nil
}

func (r *GormNotificationChannelRepository) ListByProject(ctx context.Context, projectID string) ([]*domain.NotificationChannel, error) {
	var channels []*domain.NotificationChannel
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		Find(&channels).Error
	if err != nil {
		return nil, err
	}
	return channels, nil
}

func (r *GormNotificationChannelRepository) LogDispatch(ctx context.Context, log *domain.NotificationLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

// --- Thread-Safe In-Memory Implementations for Testing ---

type InMemoryAlertRuleRepository struct {
	mu    sync.RWMutex
	rules map[string]*domain.AlertRule
}

func NewInMemoryAlertRuleRepository() *InMemoryAlertRuleRepository {
	return &InMemoryAlertRuleRepository{
		rules: make(map[string]*domain.AlertRule),
	}
}

func (r *InMemoryAlertRuleRepository) Create(ctx context.Context, rule *domain.AlertRule) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *rule
	r.rules[rule.ID] = &cp
	return nil
}

func (r *InMemoryAlertRuleRepository) FindByID(ctx context.Context, projectID, ruleID string) (*domain.AlertRule, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	rule, ok := r.rules[ruleID]
	if !ok || rule.ProjectID != projectID {
		return nil, nil
	}
	cp := *rule
	return &cp, nil
}

func (r *InMemoryAlertRuleRepository) Update(ctx context.Context, rule *domain.AlertRule, expectedVersion int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	existing, ok := r.rules[rule.ID]
	if !ok || existing.ProjectID != rule.ProjectID {
		return domain.NewAlertRuleNotFoundError()
	}
	if existing.Version != expectedVersion {
		return domain.NewVersionConflictError()
	}
	rule.Version = expectedVersion + 1
	rule.UpdatedAt = time.Now().UTC()
	cp := *rule
	r.rules[rule.ID] = &cp
	return nil
}

func (r *InMemoryAlertRuleRepository) UpdateState(ctx context.Context, ruleID string, state domain.AlertState, pendingSince *time.Time, lastEvaluatedAt, lastTriggeredAt *time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rule, ok := r.rules[ruleID]
	if !ok {
		return domain.NewAlertRuleNotFoundError()
	}
	rule.State = state
	rule.PendingSince = pendingSince
	rule.LastEvaluatedAt = lastEvaluatedAt
	if lastTriggeredAt != nil {
		rule.LastTriggeredAt = lastTriggeredAt
	}
	rule.UpdatedAt = time.Now().UTC()
	return nil
}

func (r *InMemoryAlertRuleRepository) Mute(ctx context.Context, projectID, ruleID string, mutedUntil time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rule, ok := r.rules[ruleID]
	if !ok || rule.ProjectID != projectID {
		return domain.NewAlertRuleNotFoundError()
	}
	rule.State = domain.AlertStateMuted
	rule.MutedUntil = &mutedUntil
	rule.UpdatedAt = time.Now().UTC()
	return nil
}

func (r *InMemoryAlertRuleRepository) Delete(ctx context.Context, projectID, ruleID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rule, ok := r.rules[ruleID]
	if !ok || rule.ProjectID != projectID {
		return domain.NewAlertRuleNotFoundError()
	}
	delete(r.rules, ruleID)
	return nil
}

func (r *InMemoryAlertRuleRepository) ListByProject(ctx context.Context, projectID string) ([]*domain.AlertRule, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []*domain.AlertRule
	for _, rule := range r.rules {
		if rule.ProjectID == projectID {
			cp := *rule
			out = append(out, &cp)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out, nil
}

func (r *InMemoryAlertRuleRepository) ListActiveRules(ctx context.Context) ([]*domain.AlertRule, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []*domain.AlertRule
	for _, rule := range r.rules {
		if rule.Enabled {
			cp := *rule
			out = append(out, &cp)
		}
	}
	return out, nil
}

type InMemoryIncidentRepository struct {
	mu        sync.RWMutex
	incidents map[string]*domain.Incident
	events    map[string][]*domain.IncidentEvent
}

func NewInMemoryIncidentRepository() *InMemoryIncidentRepository {
	return &InMemoryIncidentRepository{
		incidents: make(map[string]*domain.Incident),
		events:    make(map[string][]*domain.IncidentEvent),
	}
}

func (r *InMemoryIncidentRepository) Create(ctx context.Context, incident *domain.Incident) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *incident
	r.incidents[incident.ID] = &cp
	return nil
}

func (r *InMemoryIncidentRepository) FindByID(ctx context.Context, projectID, incidentID string) (*domain.Incident, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	inc, ok := r.incidents[incidentID]
	if !ok || inc.ProjectID != projectID {
		return nil, nil
	}
	cp := *inc
	return &cp, nil
}

func (r *InMemoryIncidentRepository) FindOpenByRuleID(ctx context.Context, projectID, ruleID string) (*domain.Incident, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, inc := range r.incidents {
		if inc.ProjectID == projectID && inc.RuleID == ruleID {
			if inc.Status == domain.IncidentStatusOpen || inc.Status == domain.IncidentStatusAcknowledged {
				cp := *inc
				return &cp, nil
			}
		}
	}
	return nil, nil
}

func (r *InMemoryIncidentRepository) UpdateStatus(ctx context.Context, projectID, incidentID string, status domain.IncidentStatus, by *string, at time.Time, autoResolved bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	inc, ok := r.incidents[incidentID]
	if !ok || inc.ProjectID != projectID {
		return domain.NewIncidentNotFoundError()
	}
	inc.Status = status
	inc.UpdatedAt = time.Now().UTC()
	if status == domain.IncidentStatusAcknowledged {
		inc.AcknowledgedAt = &at
		inc.AcknowledgedBy = by
	} else if status == domain.IncidentStatusResolved {
		inc.ResolvedAt = &at
		inc.ResolvedBy = by
		inc.AutoResolved = autoResolved
	}
	return nil
}

func (r *InMemoryIncidentRepository) AddEvent(ctx context.Context, event *domain.IncidentEvent) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *event
	r.events[event.IncidentID] = append(r.events[event.IncidentID], &cp)
	return nil
}

func (r *InMemoryIncidentRepository) GetTimeline(ctx context.Context, incidentID string) ([]*domain.IncidentEvent, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	evs, ok := r.events[incidentID]
	if !ok {
		return []*domain.IncidentEvent{}, nil
	}
	var out []*domain.IncidentEvent
	for _, e := range evs {
		cp := *e
		out = append(out, &cp)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].At.Before(out[j].At)
	})
	return out, nil
}

func (r *InMemoryIncidentRepository) ListByProject(ctx context.Context, projectID string, query domain.ListIncidentsQuery) ([]*domain.Incident, int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var filtered []*domain.Incident
	now := time.Now().UTC()

	var minTime *time.Time
	if query.Range != "" {
		dur := 24 * time.Hour
		switch strings.ToLower(query.Range) {
		case "15m":
			dur = 15 * time.Minute
		case "1h":
			dur = 1 * time.Hour
		case "6h":
			dur = 6 * time.Hour
		case "24h":
			dur = 24 * time.Hour
		case "7d":
			dur = 7 * 24 * time.Hour
		case "30d":
			dur = 30 * 24 * time.Hour
		}
		mt := now.Add(-dur)
		minTime = &mt
	}

	for _, inc := range r.incidents {
		if inc.ProjectID != projectID {
			continue
		}
		if query.Status != "" && query.Status != "all" && string(inc.Status) != query.Status {
			continue
		}
		if query.Severity != "" && string(inc.Severity) != query.Severity {
			continue
		}
		if minTime != nil && inc.CreatedAt.Before(*minTime) {
			continue
		}
		cp := *inc
		filtered = append(filtered, &cp)
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
	})

	total := len(filtered)
	offset := query.Offset
	if offset < 0 {
		offset = 0
	}
	limit := query.Limit
	if limit <= 0 {
		limit = 20
	} else if limit > 100 {
		limit = 100
	}

	if offset >= total {
		return []*domain.Incident{}, total, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}

	return filtered[offset:end], total, nil
}

type InMemoryNotificationChannelRepository struct {
	mu       sync.RWMutex
	channels map[string]*domain.NotificationChannel
	logs     []*domain.NotificationLog
}

func NewInMemoryNotificationChannelRepository() *InMemoryNotificationChannelRepository {
	return &InMemoryNotificationChannelRepository{
		channels: make(map[string]*domain.NotificationChannel),
		logs:     make([]*domain.NotificationLog, 0),
	}
}

func (r *InMemoryNotificationChannelRepository) Create(ctx context.Context, channel *domain.NotificationChannel) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *channel
	r.channels[channel.ID] = &cp
	return nil
}

func (r *InMemoryNotificationChannelRepository) FindByID(ctx context.Context, projectID, channelID string) (*domain.NotificationChannel, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ch, ok := r.channels[channelID]
	if !ok || ch.ProjectID != projectID {
		return nil, nil
	}
	cp := *ch
	return &cp, nil
}

func (r *InMemoryNotificationChannelRepository) Update(ctx context.Context, channel *domain.NotificationChannel) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	existing, ok := r.channels[channel.ID]
	if !ok || existing.ProjectID != channel.ProjectID {
		return domain.NewChannelNotFoundError()
	}
	channel.UpdatedAt = time.Now().UTC()
	cp := *channel
	r.channels[channel.ID] = &cp
	return nil
}

func (r *InMemoryNotificationChannelRepository) Delete(ctx context.Context, projectID, channelID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	ch, ok := r.channels[channelID]
	if !ok || ch.ProjectID != projectID {
		return domain.NewChannelNotFoundError()
	}
	delete(r.channels, channelID)
	return nil
}

func (r *InMemoryNotificationChannelRepository) ListByProject(ctx context.Context, projectID string) ([]*domain.NotificationChannel, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []*domain.NotificationChannel
	for _, ch := range r.channels {
		if ch.ProjectID == projectID {
			cp := *ch
			out = append(out, &cp)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out, nil
}

func (r *InMemoryNotificationChannelRepository) LogDispatch(ctx context.Context, log *domain.NotificationLog) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *log
	r.logs = append(r.logs, &cp)
	return nil
}
