package domain

import "time"

// CheckUsernameResponse represents the availability of a requested username.
type CheckUsernameResponse struct {
	Username  string `json:"username" example:"asha"`
	Available bool   `json:"available" example:"true"`
}

// SetUsernameRequest is the payload for claiming a unique username (one-time).
type SetUsernameRequest struct {
	Username string `json:"username" validate:"required,min=3,max=20" example:"asha"`
}

// UpdateUserRequest is the payload for updating personal profile details.
type UpdateUserRequest struct {
	FirstName string `json:"first_name" validate:"required,min=1,max=100" example:"Ada"`
	LastName  string `json:"last_name" validate:"required,min=1,max=100" example:"Byron"`
}

// CreateOrgRequest is the payload for creating a new tenant workspace.
type CreateOrgRequest struct {
	Name        string `json:"name" validate:"required,min=2,max=100" example:"Strim Labs"`
	Slug        string `json:"slug" validate:"required,min=2,max=50" example:"strim-labs"`
	Description string `json:"description" validate:"max=500" example:"Cloud telemetry platform"`
}

// UpdateOrgRequest is the payload for updating workspace details (slug is immutable).
type UpdateOrgRequest struct {
	Name        string `json:"name" validate:"required,min=2,max=100" example:"Strim Labs Global"`
	Description string `json:"description" validate:"max=500" example:"Updated platform description"`
}

// DeleteOrgRequest requires confirming the slug to avoid accidental deletion.
type DeleteOrgRequest struct {
	ConfirmSlug string `json:"confirm_slug" validate:"required" example:"strim-labs"`
}

// OrgResponse represents the organization output shape.
type OrgResponse struct {
	ID           string    `json:"id" example:"018f3a5b-7c91-7b00-8000-000000000002"`
	Name         string    `json:"name" example:"Strim Labs"`
	Slug         string    `json:"slug" example:"strim-labs"`
	Description  string    `json:"description" example:"Cloud telemetry platform"`
	Role         OrgRole   `json:"role,omitempty" example:"owner"`
	MemberCount  int       `json:"member_count" example:"3"`
	ProjectCount int       `json:"project_count" example:"0"`
	CreatedAt    time.Time `json:"created_at" example:"2026-11-01T10:00:00Z"`
}

// ToOrgResponse converts an Organization entity to OrgResponse DTO.
func ToOrgResponse(org *Organization) *OrgResponse {
	if org == nil {
		return nil
	}
	return &OrgResponse{
		ID:           org.ID,
		Name:         org.Name,
		Slug:         org.Slug,
		Description:  org.Description,
		Role:         org.Role,
		MemberCount:  org.MemberCount,
		ProjectCount: org.ProjectCount,
		CreatedAt:    org.CreatedAt,
	}
}

// AddMemberRequest is the payload for inviting/adding a member to an organization.
type AddMemberRequest struct {
	Email string  `json:"email" validate:"required,email" example:"engineer@acme.com"`
	Role  OrgRole `json:"role" validate:"required,oneof=admin member viewer" example:"member"`
}

// UpdateMemberRoleRequest is the payload for updating a member's role.
type UpdateMemberRoleRequest struct {
	Role OrgRole `json:"role" validate:"required,oneof=admin member viewer" example:"admin"`
}

// OrgMemberDetailResponse represents member information within an organization.
type OrgMemberDetailResponse struct {
	UserID    string    `json:"user_id" example:"018f3a5b-7c91-7b00-8000-000000000001"`
	Email     string    `json:"email" example:"dev@acme.com"`
	FirstName string    `json:"first_name" example:"Ada"`
	LastName  string    `json:"last_name" example:"Byron"`
	Username  *string   `json:"username,omitempty" example:"ada"`
	Role      OrgRole   `json:"role" example:"member"`
	JoinedAt  time.Time `json:"joined_at" example:"2026-11-01T10:00:00Z"`
}

// ListMembersQuery encapsulates query filtering for member listings.
type ListMembersQuery struct {
	Role   string `query:"role"`
	Q      string `query:"q"`
	Limit  int    `query:"limit"`
	Cursor string `query:"cursor"`
}
