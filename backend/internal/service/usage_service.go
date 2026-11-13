package service

import (
	"context"
	"fmt"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// UsageService manages consumption accounting, plan limits enforcement, and usage reports.
type UsageService struct {
	usageRepo   repository.UsageRepository
	projectRepo repository.ProjectRepository
	orgRepo     repository.OrgRepository
}

// NewUsageService initializes a UsageService.
func NewUsageService(
	usageRepo repository.UsageRepository,
	projectRepo repository.ProjectRepository,
	orgRepo repository.OrgRepository,
) *UsageService {
	return &UsageService{
		usageRepo:   usageRepo,
		projectRepo: projectRepo,
		orgRepo:     orgRepo,
	}
}

// GetUsage computes consumption totals against tiered limits for an organization.
func (s *UsageService) GetUsage(ctx context.Context, orgID, period, fromStr, toStr string) (*domain.UsageResponse, error) {
	if _, err := s.orgRepo.FindByID(ctx, orgID); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	var fromDate, toDate string
	var monthPrefix string

	switch period {
	case "last_month":
		lastMonth := now.AddDate(0, -1, 0)
		firstDay := time.Date(lastMonth.Year(), lastMonth.Month(), 1, 0, 0, 0, 0, time.UTC)
		lastDay := firstDay.AddDate(0, 1, -1)
		fromDate = firstDay.Format("2006-01-02")
		toDate = lastDay.Format("2006-01-02")
		monthPrefix = firstDay.Format("2006-01")
	default:
		if fromStr != "" && toStr != "" {
			fromDate = fromStr
			toDate = toStr
			if len(fromDate) >= 7 {
				monthPrefix = fromDate[:7]
			} else {
				monthPrefix = now.Format("2006-01")
			}
		} else {
			// default current_month
			firstDay := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
			lastDay := firstDay.AddDate(0, 1, -1)
			fromDate = firstDay.Format("2006-01-02")
			toDate = lastDay.Format("2006-01-02")
			monthPrefix = now.Format("2006-01")
		}
	}

	dailyCounters, err := s.usageRepo.GetDailyUsage(ctx, orgID, fromDate, toDate)
	if err != nil {
		return nil, err
	}

	totEvents, totMinutes, totRequests, err := s.usageRepo.GetMonthlyTotals(ctx, orgID, monthPrefix)
	if err != nil {
		return nil, err
	}

	projectCount, err := s.projectRepo.CountByOrg(ctx, orgID)
	if err != nil {
		return nil, err
	}

	dailyList := make([]domain.DailyUsageItem, 0, len(dailyCounters))
	for _, c := range dailyCounters {
		dailyList = append(dailyList, domain.DailyUsageItem{
			Date:              c.Date,
			EventsIngested:    c.EventsIngested,
			LoadTestMinutes:   c.LoadTestMinutes,
			RequestsGenerated: c.RequestsGenerated,
		})
	}

	resp := &domain.UsageResponse{
		Period: domain.UsagePeriod{
			From: fromDate,
			To:   toDate,
		},
		Metrics: domain.UsageMetrics{
			EventsIngested: domain.UsageMetricItem{
				Used:  totEvents,
				Limit: domain.DefaultPlanLimits.EventsIngestedLimit,
			},
			LoadTestMinutes: domain.UsageMetricItem{
				Used:  totMinutes,
				Limit: domain.DefaultPlanLimits.LoadTestMinutesLimit,
			},
			RequestsGenerated: domain.UsageMetricItem{
				Used:  totRequests,
				Limit: domain.DefaultPlanLimits.RequestsGeneratedLimit,
			},
			Projects: domain.UsageMetricItem{
				Used:  projectCount,
				Limit: domain.DefaultPlanLimits.ProjectsLimit,
			},
		},
		Daily: dailyList,
	}

	return resp, nil
}

// CheckEventsQuota ensures an incoming batch will not breach the monthly events quota.
func (s *UsageService) CheckEventsQuota(ctx context.Context, orgID string, batchCount int64) error {
	monthPrefix := time.Now().UTC().Format("2006-01")
	used, _, _, err := s.usageRepo.GetMonthlyTotals(ctx, orgID, monthPrefix)
	if err != nil {
		return err
	}

	if used+batchCount > domain.DefaultPlanLimits.EventsIngestedLimit {
		return domain.NewPlanLimitExceededError(fmt.Sprintf(
			"Monthly events ingestion quota exceeded (%d/%d events)",
			used+batchCount, domain.DefaultPlanLimits.EventsIngestedLimit,
		))
	}
	return nil
}

// CheckLoadTestQuota ensures a new load test execution will not breach monthly duration quotas.
func (s *UsageService) CheckLoadTestQuota(ctx context.Context, orgID string, plannedMinutes int64) error {
	monthPrefix := time.Now().UTC().Format("2006-01")
	_, used, _, err := s.usageRepo.GetMonthlyTotals(ctx, orgID, monthPrefix)
	if err != nil {
		return err
	}

	if used+plannedMinutes > domain.DefaultPlanLimits.LoadTestMinutesLimit {
		return domain.NewPlanLimitExceededError(fmt.Sprintf(
			"Monthly load testing duration quota exceeded (%d/%d minutes)",
			used+plannedMinutes, domain.DefaultPlanLimits.LoadTestMinutesLimit,
		))
	}
	return nil
}

// RecordIngestedEvents records freshly ingested events into daily usage counters.
func (s *UsageService) RecordIngestedEvents(ctx context.Context, orgID string, count int64) error {
	today := time.Now().UTC().Format("2006-01-02")
	return s.usageRepo.IncrementCounters(ctx, orgID, today, count, 0, 0)
}

// RecordLoadTestRun records finished load test duration and request counts into daily usage counters.
func (s *UsageService) RecordLoadTestRun(ctx context.Context, orgID string, minutes, requests int64) error {
	today := time.Now().UTC().Format("2006-01-02")
	return s.usageRepo.IncrementCounters(ctx, orgID, today, 0, minutes, requests)
}
