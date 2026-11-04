package domain

import (
	"time"

	"gorm.io/gorm"
)

// ProjectEnvironment defines target deployment stage (development, staging, production).
type ProjectEnvironment string

const (
	EnvDevelopment ProjectEnvironment = "development"
	EnvStaging     ProjectEnvironment = "staging"
	EnvProduction  ProjectEnvironment = "production"
)

// IsValid validates whether the environment matches allowed values.
func (e ProjectEnvironment) IsValid() bool {
	switch e {
	case EnvDevelopment, EnvStaging, EnvProduction:
		return true
	default:
		return false
	}
}

// VerificationStatus represents the domain ownership verification state.
type VerificationStatus string

const (
	StatusUnverified VerificationStatus = "unverified"
	StatusPending    VerificationStatus = "pending"
	StatusVerified   VerificationStatus = "verified"
	StatusFailed     VerificationStatus = "failed"
)

// ProjectHealth represents the overall operational health of a project.
type ProjectHealth string

const (
	HealthHealthy  ProjectHealth = "healthy"
	HealthDegraded ProjectHealth = "degraded"
	HealthFailing  ProjectHealth = "failing"
	HealthNoData   ProjectHealth = "no_data"
)

// Project represents an application or API service under test/monitoring within an organization.
type Project struct {
	ID                 string             `gorm:"type:uuid;primaryKey" json:"id"`
	OrgID              string             `gorm:"type:uuid;not null;index:idx_project_org_slug,unique" json:"org_id"`
	Name               string             `gorm:"type:varchar(100);not null" json:"name"`
	Slug               string             `gorm:"type:varchar(50);not null;index:idx_project_org_slug,unique" json:"slug"`
	Description        string             `gorm:"type:varchar(500)" json:"description"`
	BaseURL            string             `gorm:"type:varchar(2048);not null" json:"base_url"`
	Environment        ProjectEnvironment `gorm:"type:varchar(20);not null;default:'production'" json:"environment"`
	VerificationStatus VerificationStatus `gorm:"type:varchar(20);not null;default:'unverified'" json:"verification_status"`
	VerifiedAt         *time.Time         `json:"verified_at,omitempty"`
	CreatedAt          time.Time          `gorm:"not null;autoCreateTime" json:"created_at"`
	UpdatedAt          time.Time          `gorm:"not null;autoUpdateTime" json:"updated_at"`
	DeletedAt          gorm.DeletedAt     `gorm:"index" json:"-"`

	// Relationships
	Organization Organization `gorm:"foreignKey:OrgID;constraint:OnDelete:CASCADE" json:"-"`

	// Transient fields for output
	EndpointCount int           `gorm:"-" json:"endpoint_count"`
	Health        ProjectHealth `gorm:"-" json:"health"`
}

// VerificationMethod specifies the method used to prove domain ownership.
type VerificationMethod string

const (
	MethodDNS  VerificationMethod = "dns"
	MethodFile VerificationMethod = "file"
)

// ProjectVerification tracks active verification tokens and proof attempts.
type ProjectVerification struct {
	ID        string             `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID string             `gorm:"type:uuid;not null;index" json:"project_id"`
	Method    VerificationMethod `gorm:"type:varchar(20);not null" json:"method"`
	Token     string             `gorm:"type:varchar(64);not null;uniqueIndex" json:"token"`
	Status    VerificationStatus `gorm:"type:varchar(20);not null;default:'pending'" json:"status"`
	CheckedAt *time.Time         `json:"checked_at,omitempty"`
	ExpiresAt time.Time          `gorm:"not null;index" json:"expires_at"`
	CreatedAt time.Time          `gorm:"not null;autoCreateTime" json:"created_at"`

	Project Project `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE" json:"-"`
}
