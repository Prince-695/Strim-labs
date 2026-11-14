package domain

import (
	"strings"
	"time"
)

// CreateAPIKeyRequest defines payload to issue a new project API key.
type CreateAPIKeyRequest struct {
	Name      string     `json:"name" validate:"required,min=1,max=100"`
	Scopes    []string   `json:"scopes" validate:"required,min=1"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// Validate ensures scopes contain valid APIKeyScope values.
func (r *CreateAPIKeyRequest) Validate() *AppError {
	r.Name = strings.TrimSpace(r.Name)
	if r.Name == "" {
		return NewValidationError("name", "API key name is required")
	}
	if len(r.Scopes) == 0 {
		return NewValidationError("scopes", "At least one scope is required (ingest, discovery, read)")
	}
	validScopes := map[APIKeyScope]bool{
		ScopeIngest:    true,
		ScopeDiscovery: true,
		ScopeRead:      true,
	}
	for _, s := range r.Scopes {
		if !validScopes[APIKeyScope(strings.TrimSpace(s))] {
			return NewValidationError("scopes", "Invalid scope '"+s+"'. Allowed: ingest, discovery, read")
		}
	}
	return nil
}

// RotateAPIKeyRequest defines parameters for rotating an API key with dual-active grace period.
type RotateAPIKeyRequest struct {
	GraceHours *int `json:"grace_hours,omitempty" validate:"omitempty,min=0,max=720"` // Default 24 hours
}

// APIKeyResponse represents the public view of an API key.
type APIKeyResponse struct {
	ID         string     `json:"id"`
	ProjectID  string     `json:"project_id"`
	Name       string     `json:"name"`
	Prefix     string     `json:"prefix"`
	Secret     string     `json:"secret,omitempty"` // Populated ONLY on creation or rotation
	Scopes     []string   `json:"scopes"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	Message    string     `json:"message,omitempty"`
}

// ToAPIKeyResponse formats an APIKey model into a public DTO.
func ToAPIKeyResponse(k *APIKey, secret string) APIKeyResponse {
	resp := APIKeyResponse{
		ID:         k.ID,
		ProjectID:  k.ProjectID,
		Name:       k.Name,
		Prefix:     k.Prefix,
		Scopes:     k.Scopes,
		ExpiresAt:  k.ExpiresAt,
		LastUsedAt: k.LastUsedAt,
		CreatedAt:  k.CreatedAt,
	}
	if secret != "" {
		resp.Secret = secret
		resp.Message = "Copy this key now. It will not be shown again."
	}
	return resp
}
