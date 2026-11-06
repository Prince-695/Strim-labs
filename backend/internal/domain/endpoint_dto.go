package domain

import (
	"time"
)

// StatsSummary represents rolling window throughput and latency statistics.
type StatsSummary struct {
	Requests  int64   `json:"requests" example:"12044"`
	RPS       float64 `json:"rps" example:"3.3"`
	P95Ms     float64 `json:"p95_ms" example:"182"`
	ErrorRate float64 `json:"error_rate" example:"0.004"`
}

// EndpointResponse represents the output payload for an endpoint in the API registry.
type EndpointResponse struct {
	ID           string         `json:"id" example:"018f3a5b-7c91-7b00-8000-000000000021"`
	Method       string         `json:"method" example:"POST"`
	PathTemplate string         `json:"path_template" example:"/orders/{id}/items"`
	Service      string         `json:"service" example:"orders"`
	Tags         []string       `json:"tags" example:"[\"checkout\"]"`
	Status       EndpointStatus `json:"status" example:"active"`
	Sources      []string       `json:"sources" example:"[\"openapi\",\"runtime\"]"`
	Note         string         `json:"note,omitempty" example:"internal only"`
	FirstSeen    time.Time      `json:"first_seen" example:"2026-11-06T10:00:00Z"`
	LastSeen     time.Time      `json:"last_seen" example:"2026-11-06T12:00:00Z"`
	Stats1h      StatsSummary   `json:"stats_1h"`
}

// EndpointSourceDetail provides source provenance details for an endpoint.
type EndpointSourceDetail struct {
	Source    DiscoverySource `json:"source" example:"openapi"`
	FirstSeen time.Time       `json:"first_seen" example:"2026-11-06T10:00:00Z"`
	LastSeen  time.Time       `json:"last_seen" example:"2026-11-06T12:00:00Z"`
	Metadata  JSONMap         `json:"metadata"`
}

// EndpointDetailResponse represents an endpoint with source provenance and 24h rolling stats.
type EndpointDetailResponse struct {
	EndpointResponse
	SourcesDetail []EndpointSourceDetail `json:"sources_detail"`
	Stats24h      StatsSummary           `json:"stats_24h"`
}

// PatchEndpointRequest is the payload to update endpoint metadata or status.
type PatchEndpointRequest struct {
	Tags   *[]string       `json:"tags,omitempty" example:"[\"checkout\",\"v1\"]"`
	Status *EndpointStatus `json:"status,omitempty" validate:"omitempty,oneof=active ignored" example:"ignored"`
	Note   *string         `json:"note,omitempty" validate:"omitempty,max=500" example:"Deprecated endpoint"`
}

// ListEndpointsQuery specifies query filters for listing endpoints in the registry.
type ListEndpointsQuery struct {
	Q       string `query:"q"`
	Method  string `query:"method"`
	Tag     string `query:"tag"`
	Source  string `query:"source"`
	Status  string `query:"status"`
	Service string `query:"service"`
	Sort    string `query:"sort"`
	Limit   int    `query:"limit"`
	Cursor  string `query:"cursor"`
}

// ImportOpenAPIRequest is the JSON payload for importing an OpenAPI spec from a URL.
type ImportOpenAPIRequest struct {
	URL string `json:"url" validate:"omitempty,url" example:"https://api.acme.com/openapi.json"`
}

// DiscoveryManifestRoute specifies an individual route entry in a discovery manifest.
type DiscoveryManifestRoute struct {
	Method string   `json:"method" validate:"required" example:"GET"`
	Path   string   `json:"path" validate:"required" example:"/orders/{id}"`
	Tags   []string `json:"tags,omitempty" example:"[\"orders\"]"`
}

// DiscoveryManifest represents the v1 route discovery manifest payload.
type DiscoveryManifest struct {
	Version int                      `json:"version" validate:"required,eq=1" example:"1"`
	Source  DiscoverySource          `json:"source" validate:"required,oneof=manifest ci" example:"manifest"`
	Service string                   `json:"service" validate:"required,min=1,max=100" example:"orders"`
	Commit  string                   `json:"commit,omitempty" example:"a1b2c3d"`
	Branch  string                   `json:"branch,omitempty" example:"main"`
	Repo    string                   `json:"repo,omitempty" example:"acme/orders"`
	Routes  []DiscoveryManifestRoute `json:"routes" validate:"required,min=1"`
}

// DiscoveryRunResponse represents the audit output for a discovery run.
type DiscoveryRunResponse struct {
	ID         string          `json:"id" example:"018f3a5b-7c91-7b00-8000-000000000030"`
	ProjectID  string          `json:"project_id" example:"018f3a5b-7c91-7b00-8000-000000000010"`
	Source     DiscoverySource `json:"source" example:"openapi"`
	Status     RunStatus       `json:"status" example:"completed"`
	Found      int             `json:"found" example:"15"`
	Created    int             `json:"created" example:"10"`
	Updated    int             `json:"updated" example:"5"`
	Error      string          `json:"error,omitempty" example:""`
	Metadata   JSONMap         `json:"metadata,omitempty"`
	StartedAt  time.Time       `json:"started_at" example:"2026-11-06T10:00:00Z"`
	FinishedAt *time.Time      `json:"finished_at,omitempty" example:"2026-11-06T10:00:02Z"`
}

// ToEndpointResponse converts an APIEndpoint model to EndpointResponse.
func ToEndpointResponse(e *APIEndpoint) *EndpointResponse {
	if e == nil {
		return nil
	}
	tags := []string(e.Tags)
	if tags == nil {
		tags = []string{}
	}
	sources := e.SourcesList
	if sources == nil {
		sources = []string{}
	}
	return &EndpointResponse{
		ID:           e.ID,
		Method:       e.Method,
		PathTemplate: e.PathTemplate,
		Service:      e.Service,
		Tags:         tags,
		Status:       e.Status,
		Sources:      sources,
		Note:         e.Note,
		FirstSeen:    e.FirstSeen,
		LastSeen:     e.LastSeen,
		Stats1h:      e.Stats1h,
	}
}

// ToDiscoveryRunResponse converts a DiscoveryRun model to DiscoveryRunResponse.
func ToDiscoveryRunResponse(r *DiscoveryRun) *DiscoveryRunResponse {
	if r == nil {
		return nil
	}
	return &DiscoveryRunResponse{
		ID:         r.ID,
		ProjectID:  r.ProjectID,
		Source:     r.Source,
		Status:     r.Status,
		Found:      r.Found,
		Created:    r.Created,
		Updated:    r.Updated,
		Error:      r.Error,
		Metadata:   r.Metadata,
		StartedAt:  r.StartedAt,
		FinishedAt: r.FinishedAt,
	}
}
