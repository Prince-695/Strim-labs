package domain

import (
	"time"
)

// CreateProjectRequest is the payload for creating a new project.
type CreateProjectRequest struct {
	Name        string             `json:"name" validate:"required,min=2,max=100" example:"Checkout API"`
	Slug        string             `json:"slug" validate:"required,min=2,max=50" example:"checkout-api"`
	Description string             `json:"description" validate:"max=500" example:"Orders and payments"`
	BaseURL     string             `json:"base_url" validate:"required,url" example:"https://api.acme.com"`
	Environment ProjectEnvironment `json:"environment" validate:"omitempty,oneof=development staging production" example:"production"`
}

// UpdateProjectRequest is the payload for updating project settings.
type UpdateProjectRequest struct {
	Name        *string             `json:"name,omitempty" validate:"omitempty,min=2,max=100" example:"Checkout API v2"`
	Description *string             `json:"description,omitempty" validate:"omitempty,max=500" example:"Updated description"`
	BaseURL     *string             `json:"base_url,omitempty" validate:"omitempty,url" example:"https://api-v2.acme.com"`
	Environment *ProjectEnvironment `json:"environment,omitempty" validate:"omitempty,oneof=development staging production" example:"staging"`
}

// ProjectResponse represents the project output DTO.
type ProjectResponse struct {
	ID                 string             `json:"id" example:"018f3a5b-7c91-7b00-8000-000000000010"`
	OrgID              string             `json:"org_id" example:"018f3a5b-7c91-7b00-8000-000000000002"`
	Name               string             `json:"name" example:"Checkout API"`
	Slug               string             `json:"slug" example:"checkout-api"`
	Description        string             `json:"description" example:"Orders and payments"`
	BaseURL            string             `json:"base_url" example:"https://api.acme.com"`
	Environment        ProjectEnvironment `json:"environment" example:"production"`
	VerificationStatus VerificationStatus `json:"verification_status" example:"unverified"`
	VerifiedAt         *time.Time         `json:"verified_at,omitempty"`
	EndpointCount      int                `json:"endpoint_count" example:"0"`
	Health             ProjectHealth      `json:"health" example:"no_data"`
	CreatedAt          time.Time          `json:"created_at" example:"2026-11-04T10:00:00Z"`
	UpdatedAt          time.Time          `json:"updated_at" example:"2026-11-04T10:00:00Z"`
}

// ProjectStats1h represents quick rolling 1-hour stats for GET {PRJ}.
type ProjectStats1h struct {
	Requests  int64   `json:"requests" example:"0"`
	P95Ms     float64 `json:"p95_ms" example:"0"`
	ErrorRate float64 `json:"error_rate" example:"0"`
}

// ProjectLastTest represents info about the most recent test run.
type ProjectLastTest struct {
	ID     string `json:"id" example:"018f3a5b-7c91-7b00-8000-000000000020"`
	Status string `json:"status" example:"completed"`
}

// ProjectDetailResponse includes project metadata plus live statistics.
type ProjectDetailResponse struct {
	ProjectResponse
	Stats1h     ProjectStats1h   `json:"stats_1h"`
	LastEventAt *time.Time       `json:"last_event_at,omitempty"`
	LastTest    *ProjectLastTest `json:"last_test,omitempty"`
}

// ToProjectResponse maps domain.Project to ProjectResponse.
func ToProjectResponse(p *Project) *ProjectResponse {
	if p == nil {
		return nil
	}
	health := p.Health
	if health == "" {
		health = HealthNoData
	}
	return &ProjectResponse{
		ID:                 p.ID,
		OrgID:              p.OrgID,
		Name:               p.Name,
		Slug:               p.Slug,
		Description:        p.Description,
		BaseURL:            p.BaseURL,
		Environment:        p.Environment,
		VerificationStatus: p.VerificationStatus,
		VerifiedAt:         p.VerifiedAt,
		EndpointCount:      p.EndpointCount,
		Health:             health,
		CreatedAt:          p.CreatedAt,
		UpdatedAt:          p.UpdatedAt,
	}
}

// InitiateVerificationRequest is the payload to start domain verification.
type InitiateVerificationRequest struct {
	Method VerificationMethod `json:"method" validate:"required,oneof=dns file" example:"dns"`
}

// DNSInstructions describes the DNS TXT record needed.
type DNSInstructions struct {
	Type  string `json:"type" example:"TXT"`
	Host  string `json:"host" example:"_strim.api.acme.com"`
	Value string `json:"value" example:"strim-verify=8f3a9c..."`
}

// FileInstructions describes the HTTP well-known file needed.
type FileInstructions struct {
	URL     string `json:"url" example:"https://api.acme.com/.well-known/strim-verify.txt"`
	Content string `json:"content" example:"8f3a9c..."`
}

// VerificationInstructions provides instructions for both DNS and HTTP file proof.
type VerificationInstructions struct {
	DNS  DNSInstructions  `json:"dns"`
	File FileInstructions `json:"file"`
}

// VerificationResponse represents the output of POST/GET verification.
type VerificationResponse struct {
	Status       VerificationStatus       `json:"status" example:"pending"`
	Method       VerificationMethod       `json:"method" example:"dns"`
	Token        string                   `json:"token" example:"strim-verify=8f3a9c..."`
	Instructions VerificationInstructions `json:"instructions"`
	ExpiresAt    time.Time                `json:"expires_at" example:"2026-11-05T10:00:00Z"`
}

// CheckVerificationResponse represents the immediate result of POST /verification/check.
type CheckVerificationResponse struct {
	Status     VerificationStatus `json:"status" example:"verified"`
	VerifiedAt *time.Time         `json:"verified_at,omitempty"`
	Reason     string             `json:"reason,omitempty" example:"TXT record not found"`
}
