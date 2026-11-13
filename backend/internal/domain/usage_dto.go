package domain

// UsagePeriod specifies the date span analyzed in the usage report.
type UsagePeriod struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// UsageMetricItem holds consumption totals against resource allowances.
type UsageMetricItem struct {
	Used  int64 `json:"used"`
	Limit int64 `json:"limit"`
}

// UsageMetrics holds all tracked metric quotas for an organization.
type UsageMetrics struct {
	EventsIngested    UsageMetricItem `json:"events_ingested"`
	LoadTestMinutes   UsageMetricItem `json:"load_test_minutes"`
	RequestsGenerated UsageMetricItem `json:"requests_generated"`
	Projects          UsageMetricItem `json:"projects"`
}

// DailyUsageItem represents a single day's resource consumption.
type DailyUsageItem struct {
	Date              string `json:"date"`
	EventsIngested    int64  `json:"events_ingested"`
	LoadTestMinutes   int64  `json:"load_test_minutes"`
	RequestsGenerated int64  `json:"requests_generated"`
}

// UsageResponse is the full report returned by GET /usage.
type UsageResponse struct {
	Period  UsagePeriod      `json:"period"`
	Metrics UsageMetrics     `json:"metrics"`
	Daily   []DailyUsageItem `json:"daily"`
}
