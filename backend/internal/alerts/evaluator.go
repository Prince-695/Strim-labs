package alerts

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/ingest"
	"github.com/Prince-695/strim/backend/internal/notify"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// Evaluator checks active alert rules against live telemetry metrics,
// drives the alert state machine with hysteresis, and manages incident lifecycles.
type Evaluator struct {
	alertRepo    repository.AlertRuleRepository
	incidentRepo repository.IncidentRepository
	channelRepo  repository.NotificationChannelRepository
	endpointRepo repository.EndpointRepository
	store        ingest.TimeSeriesStore
	dispatcher   notify.Dispatcher
	clock        clock.Clock
	idGen        ids.IDGenerator
	logger       *slog.Logger
}

// NewEvaluator creates a new Evaluator instance.
func NewEvaluator(
	alertRepo repository.AlertRuleRepository,
	incidentRepo repository.IncidentRepository,
	channelRepo repository.NotificationChannelRepository,
	endpointRepo repository.EndpointRepository,
	store ingest.TimeSeriesStore,
	dispatcher notify.Dispatcher,
	clk clock.Clock,
	idGen ids.IDGenerator,
	logger *slog.Logger,
) *Evaluator {
	if clk == nil {
		clk = clock.NewRealClock()
	}
	if idGen == nil {
		idGen = ids.NewUUIDv7Generator()
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Evaluator{
		alertRepo:    alertRepo,
		incidentRepo: incidentRepo,
		channelRepo:  channelRepo,
		endpointRepo: endpointRepo,
		store:        store,
		dispatcher:   dispatcher,
		clock:        clk,
		idGen:        idGen,
		logger:       logger,
	}
}

// EvaluateAll scans and processes all enabled alert rules across all projects.
func (e *Evaluator) EvaluateAll(ctx context.Context) error {
	rules, err := e.alertRepo.ListActiveRules(ctx)
	if err != nil {
		return fmt.Errorf("failed to list active alert rules: %w", err)
	}

	for _, rule := range rules {
		if err := e.EvaluateRule(ctx, rule); err != nil {
			e.logger.ErrorContext(ctx, "Failed to evaluate alert rule",
				slog.String("rule_id", rule.ID),
				slog.String("project_id", rule.ProjectID),
				slog.Any("error", err),
			)
		}
	}
	return nil
}

// EvaluateRule evaluates a single alert rule against current metrics and triggers state transitions.
func (e *Evaluator) EvaluateRule(ctx context.Context, rule *domain.AlertRule) error {
	if rule == nil || !rule.Enabled {
		return nil
	}

	now := e.clock.Now().UTC()

	// 1. Check if rule is currently muted
	if rule.State == domain.AlertStateMuted {
		if rule.MutedUntil != nil && now.Before(*rule.MutedUntil) {
			return nil // Still within muted window
		}
		// Mute period expired; return to OK state for re-evaluation
		rule.State = domain.AlertStateOK
		rule.MutedUntil = nil
	}

	// 2. Decode scope and condition
	var scope domain.AlertScope
	if len(rule.Scope) > 0 {
		b, _ := json.Marshal(rule.Scope)
		_ = json.Unmarshal(b, &scope)
	}
	if scope.Type == "" {
		scope.Type = domain.AlertScopeProject
	}

	var condition domain.AlertCondition
	if len(rule.Condition) > 0 {
		b, _ := json.Marshal(rule.Condition)
		_ = json.Unmarshal(b, &condition)
	}

	windowDuration := parseDurationString(condition.Window, 5*time.Minute)
	forDuration := parseDurationString(condition.For, 0)

	start := now.Add(-windowDuration)
	end := now

	// 3. Query telemetry metrics
	events, err := e.store.QueryEvents(ctx, rule.ProjectID, start, end, 10000)
	if err != nil {
		return fmt.Errorf("failed to query telemetry events: %w", err)
	}

	// Filter by endpoint if scoped
	if scope.Type == domain.AlertScopeEndpoint && scope.EndpointID != nil && *scope.EndpointID != "" {
		ep, err := e.endpointRepo.FindByID(ctx, rule.ProjectID, *scope.EndpointID)
		if err == nil && ep != nil {
			var filtered []domain.RequestEvent
			for _, ev := range events {
				if ev.Method == ep.Method && ev.Route == ep.PathTemplate {
					filtered = append(filtered, ev)
				}
			}
			events = filtered
		}
	}

	// 4. Calculate metric value
	currentValue := calculateMetric(events, condition.Metric, windowDuration)
	breached := evaluateOperator(currentValue, condition.Operator, condition.Threshold)

	// 5. State Machine & Hysteresis
	newState := rule.State
	var pendingSince *time.Time = rule.PendingSince
	var lastTriggeredAt *time.Time = rule.LastTriggeredAt
	evalTime := now

	if breached {
		switch rule.State {
		case domain.AlertStateOK, domain.AlertStateResolved:
			if forDuration <= 0 {
				// Immediate firing
				newState = domain.AlertStateFiring
				lastTriggeredAt = &now
				pendingSince = nil
				e.handleIncidentOpened(ctx, rule, currentValue, condition.Threshold, now)
			} else {
				// Enter pending state
				newState = domain.AlertStatePending
				pendingSince = &now
			}

		case domain.AlertStatePending:
			if pendingSince != nil && now.Sub(*pendingSince) >= forDuration {
				// Condition persisted through "for" duration -> move to firing
				newState = domain.AlertStateFiring
				lastTriggeredAt = &now
				pendingSince = nil
				e.handleIncidentOpened(ctx, rule, currentValue, condition.Threshold, now)
			}

		case domain.AlertStateFiring:
			// Update current metric value on existing open incident
			if openInc, err := e.incidentRepo.FindOpenByRuleID(ctx, rule.ProjectID, rule.ID); err == nil && openInc != nil {
				openInc.CurrentValue = currentValue
				openInc.UpdatedAt = now
				_ = e.incidentRepo.UpdateStatus(ctx, rule.ProjectID, openInc.ID, openInc.Status, nil, now, false)
			}
		}
	} else {
		// Condition healthy / recovered
		switch rule.State {
		case domain.AlertStatePending:
			// Transient spike recovered within "for" window -> reset without firing (anti-flapping!)
			newState = domain.AlertStateOK
			pendingSince = nil

		case domain.AlertStateFiring:
			// Outage recovered -> auto-resolve incident
			newState = domain.AlertStateResolved
			pendingSince = nil
			e.handleIncidentResolved(ctx, rule, currentValue, condition.Threshold, now)

		case domain.AlertStateResolved:
			newState = domain.AlertStateOK
		}
	}

	return e.alertRepo.UpdateState(ctx, rule.ID, newState, pendingSince, &evalTime, lastTriggeredAt)
}

func (e *Evaluator) handleIncidentOpened(ctx context.Context, rule *domain.AlertRule, currentVal, threshold float64, now time.Time) {
	// Check if incident is already open
	existing, err := e.incidentRepo.FindOpenByRuleID(ctx, rule.ProjectID, rule.ID)
	if err == nil && existing != nil {
		return
	}

	incID := e.idGen.MustNewUUIDv7()
	title := fmt.Sprintf("Alert fired: %s", rule.Name)
	summary := fmt.Sprintf("Metric '%s' breached threshold (current: %.2f, threshold: %.2f)",
		getRuleMetric(rule), currentVal, threshold)

	inc := &domain.Incident{
		ID:             incID,
		OrgID:          rule.OrgID,
		ProjectID:      rule.ProjectID,
		RuleID:         rule.ID,
		Status:         domain.IncidentStatusOpen,
		Severity:       rule.Severity,
		Title:          title,
		Summary:        summary,
		CurrentValue:   currentVal,
		ThresholdValue: threshold,
		AutoResolved:   false,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := e.incidentRepo.Create(ctx, inc); err != nil {
		e.logger.ErrorContext(ctx, "Failed to create incident on alert fire", slog.Any("error", err))
		return
	}

	// Add timeline event
	_ = e.incidentRepo.AddEvent(ctx, &domain.IncidentEvent{
		ID:         e.idGen.MustNewUUIDv7(),
		IncidentID: incID,
		Type:       domain.IncidentEventOpened,
		Actor:      "system",
		Detail:     summary,
		At:         now,
	})

	// Dispatch notifications to configured channels
	e.dispatchToChannels(ctx, rule, inc, domain.IncidentEventOpened)
}

func (e *Evaluator) handleIncidentResolved(ctx context.Context, rule *domain.AlertRule, currentVal, threshold float64, now time.Time) {
	openInc, err := e.incidentRepo.FindOpenByRuleID(ctx, rule.ProjectID, rule.ID)
	if err != nil || openInc == nil {
		return
	}

	if err := e.incidentRepo.UpdateStatus(ctx, rule.ProjectID, openInc.ID, domain.IncidentStatusResolved, nil, now, true); err != nil {
		e.logger.ErrorContext(ctx, "Failed to auto-resolve incident", slog.Any("error", err))
		return
	}

	detail := fmt.Sprintf("Metric recovered within threshold (current: %.2f, threshold: %.2f)", currentVal, threshold)
	_ = e.incidentRepo.AddEvent(ctx, &domain.IncidentEvent{
		ID:         e.idGen.MustNewUUIDv7(),
		IncidentID: openInc.ID,
		Type:       domain.IncidentEventResolved,
		Actor:      "system",
		Detail:     detail,
		At:         now,
	})

	openInc.Status = domain.IncidentStatusResolved
	openInc.CurrentValue = currentVal
	e.dispatchToChannels(ctx, rule, openInc, domain.IncidentEventResolved)
}

func (e *Evaluator) dispatchToChannels(ctx context.Context, rule *domain.AlertRule, incident *domain.Incident, eventType domain.IncidentEventType) {
	if e.dispatcher == nil {
		return
	}

	channelIDs := extractChannelIDs(rule.ChannelIDs)
	for _, chID := range channelIDs {
		ch, err := e.channelRepo.FindByID(ctx, rule.ProjectID, chID)
		if err != nil || ch == nil || !ch.Enabled {
			continue
		}

		dispatchErr := e.dispatcher.Dispatch(ctx, ch, incident, rule, eventType)
		status := "success"
		errMsg := ""
		if dispatchErr != nil {
			status = "failed"
			errMsg = dispatchErr.Error()
		}

		_ = e.channelRepo.LogDispatch(ctx, &domain.NotificationLog{
			ID:         e.idGen.MustNewUUIDv7(),
			ChannelID:  ch.ID,
			IncidentID: incident.ID,
			Type:       ch.Type,
			Status:     status,
			Error:      errMsg,
			SentAt:     time.Now().UTC(),
		})
	}
}

func calculateMetric(events []domain.RequestEvent, metric string, windowDuration time.Duration) float64 {
	if len(events) == 0 {
		return 0.0
	}

	switch strings.ToLower(strings.TrimSpace(metric)) {
	case "error_rate":
		var errors int64
		for _, e := range events {
			if e.Status >= 500 {
				errors++
			}
		}
		return float64(errors) / float64(len(events))

	case "latency_p95", "latency_p99":
		durations := make([]float64, len(events))
		for i, e := range events {
			durations[i] = e.DurationMs
		}
		sort.Float64s(durations)
		p := 0.95
		if strings.ToLower(metric) == "latency_p99" {
			p = 0.99
		}
		idx := int(float64(len(durations)-1) * p)
		return durations[idx]

	case "rps":
		secs := windowDuration.Seconds()
		if secs <= 0 {
			secs = 60
		}
		return float64(len(events)) / secs

	default:
		return 0.0
	}
}

func evaluateOperator(val float64, op string, threshold float64) bool {
	switch strings.TrimSpace(op) {
	case ">":
		return val > threshold
	case ">=":
		return val >= threshold
	case "<":
		return val < threshold
	case "<=":
		return val <= threshold
	default:
		return false
	}
}

func parseDurationString(s string, defaultDur time.Duration) time.Duration {
	s = strings.TrimSpace(s)
	if s == "" {
		return defaultDur
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return defaultDur
	}
	return d
}

func extractChannelIDs(m domain.JSONMap) []string {
	if len(m) == 0 {
		return nil
	}
	raw, ok := m["items"].([]interface{})
	if !ok {
		return nil
	}
	var out []string
	for _, item := range raw {
		if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
			out = append(out, s)
		}
	}
	return out
}

func getRuleMetric(rule *domain.AlertRule) string {
	if len(rule.Condition) == 0 {
		return "metric"
	}
	if m, ok := rule.Condition["metric"].(string); ok {
		return m
	}
	return "metric"
}
