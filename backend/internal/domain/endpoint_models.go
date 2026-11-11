package domain

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// EndpointStatus defines the lifecycle state of a discovered endpoint.
type EndpointStatus string

const (
	EndpointStatusActive  EndpointStatus = "active"
	EndpointStatusStale   EndpointStatus = "stale"
	EndpointStatusIgnored EndpointStatus = "ignored"
)

func (s EndpointStatus) IsValid() bool {
	switch s {
	case EndpointStatusActive, EndpointStatusStale, EndpointStatusIgnored:
		return true
	default:
		return false
	}
}

// DiscoverySource identifies the mechanism through which an endpoint was discovered.
type DiscoverySource string

const (
	SourceOpenAPI  DiscoverySource = "openapi"
	SourceCI       DiscoverySource = "ci"
	SourceManifest DiscoverySource = "manifest"
	SourceRuntime  DiscoverySource = "runtime"
)

func (s DiscoverySource) IsValid() bool {
	switch s {
	case SourceOpenAPI, SourceCI, SourceManifest, SourceRuntime:
		return true
	default:
		return false
	}
}

// RunStatus defines the execution state of a discovery job or ingestion import.
type RunStatus string

const (
	RunStatusRunning   RunStatus = "running"
	RunStatusCompleted RunStatus = "completed"
	RunStatusFailed    RunStatus = "failed"
)

// StringSlice handles jsonb serialization for string slices.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	return json.Marshal(s)
}

func (s *StringSlice) Scan(value interface{}) error {
	if value == nil {
		*s = []string{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("unsupported type for StringSlice: %T", value)
	}
	if len(bytes) == 0 {
		*s = []string{}
		return nil
	}
	return json.Unmarshal(bytes, s)
}

// JSONMap handles jsonb serialization for generic key-value maps.
type JSONMap map[string]interface{}

func (m JSONMap) Value() (driver.Value, error) {
	if m == nil {
		return "{}", nil
	}
	return json.Marshal(m)
}

func (m *JSONMap) Scan(value interface{}) error {
	if value == nil {
		*m = JSONMap{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("unsupported type for JSONMap: %T", value)
	}
	if len(bytes) == 0 {
		*m = JSONMap{}
		return nil
	}
	return json.Unmarshal(bytes, m)
}

// APIEndpoint represents a single discovered HTTP route inside a project.
type APIEndpoint struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID    string         `gorm:"type:uuid;not null;index:idx_endpoint_proj_method_path,unique" json:"project_id"`
	Method       string         `gorm:"type:varchar(10);not null;index:idx_endpoint_proj_method_path,unique" json:"method"`
	PathTemplate string         `gorm:"type:varchar(2048);not null;index:idx_endpoint_proj_method_path,unique" json:"path_template"`
	Service      string         `gorm:"type:varchar(100);not null;default:''" json:"service"`
	Tags         StringSlice    `gorm:"type:jsonb;not null;default:'[]'" json:"tags"`
	Status       EndpointStatus `gorm:"type:varchar(20);not null;default:'active';index" json:"status"`
	Note         string         `gorm:"type:varchar(500);default:''" json:"note"`
	FirstSeen    time.Time      `gorm:"not null;autoCreateTime" json:"first_seen"`
	LastSeen     time.Time      `gorm:"not null;autoUpdateTime;index" json:"last_seen"`
	CreatedAt    time.Time      `gorm:"not null;autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"not null;autoUpdateTime" json:"updated_at"`

	// Relationships
	Project Project          `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE" json:"-"`
	Sources []EndpointSource `gorm:"foreignKey:EndpointID;constraint:OnDelete:CASCADE" json:"sources_detail,omitempty"`

	// Transient fields for output
	SourcesList []string     `gorm:"-" json:"sources"`
	Stats1h     StatsSummary `gorm:"-" json:"stats_1h"`
}

// EndpointSource records discovery verification of an endpoint by a specific source.
type EndpointSource struct {
	ID         string          `gorm:"type:uuid;primaryKey" json:"id"`
	EndpointID string          `gorm:"type:uuid;not null;index:idx_endpoint_source,unique" json:"endpoint_id"`
	Source     DiscoverySource `gorm:"type:varchar(20);not null;index:idx_endpoint_source,unique" json:"source"`
	FirstSeen  time.Time       `gorm:"not null;autoCreateTime" json:"first_seen"`
	LastSeen   time.Time       `gorm:"not null;autoUpdateTime" json:"last_seen"`
	Metadata   JSONMap         `gorm:"type:jsonb;default:'{}'" json:"metadata"`

	Endpoint APIEndpoint `gorm:"foreignKey:EndpointID;constraint:OnDelete:CASCADE" json:"-"`
}

// DiscoveryRun stores execution audit records for discovery runs (OpenAPI, CI, Manifests).
type DiscoveryRun struct {
	ID         string          `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID  string          `gorm:"type:uuid;not null;index" json:"project_id"`
	Source     DiscoverySource `gorm:"type:varchar(20);not null" json:"source"`
	Status     RunStatus       `gorm:"type:varchar(20);not null;default:'running'" json:"status"`
	Found      int             `gorm:"not null;default:0" json:"found"`
	Created    int             `gorm:"not null;default:0" json:"created"`
	Updated    int             `gorm:"not null;default:0" json:"updated"`
	Error      string          `gorm:"type:text;default:''" json:"error"`
	Metadata   JSONMap         `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	StartedAt  time.Time       `gorm:"not null;autoCreateTime" json:"started_at"`
	FinishedAt *time.Time      `json:"finished_at,omitempty"`

	Project Project `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE" json:"-"`
}
