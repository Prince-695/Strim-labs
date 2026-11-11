package domain

import (
	"time"

	"gorm.io/gorm"
)

// OrgRole represents a user's authorization tier within an organization.
type OrgRole string

const (
	RoleOwner  OrgRole = "owner"
	RoleAdmin  OrgRole = "admin"
	RoleMember OrgRole = "member"
	RoleViewer OrgRole = "viewer"
)

// RoleWeights defines hierarchical priority: viewer (1) < member (2) < admin (3) < owner (4)
var RoleWeights = map[OrgRole]int{
	RoleViewer: 1,
	RoleMember: 2,
	RoleAdmin:  3,
	RoleOwner:  4,
}

// IsValid checks if role is one of the recognized organization roles.
func (r OrgRole) IsValid() bool {
	_, ok := RoleWeights[r]
	return ok
}

// AtLeast checks if role weight is greater than or equal to the minimum required role.
func (r OrgRole) AtLeast(min OrgRole) bool {
	return RoleWeights[r] >= RoleWeights[min]
}

// Organization represents a multi-tenant workspace in STRIM Labs.
type Organization struct {
	ID          string         `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string         `gorm:"type:varchar(100);not null" json:"name"`
	Slug        string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"slug"`
	Description string         `gorm:"type:varchar(500)" json:"description"`
	CreatedBy   string         `gorm:"type:uuid;not null;index" json:"created_by"`
	CreatedAt   time.Time      `gorm:"not null;autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"not null;autoUpdateTime" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Transient fields populated for API responses
	Role         OrgRole `gorm:"-" json:"role,omitempty"`
	MemberCount  int     `gorm:"-" json:"member_count,omitempty"`
	ProjectCount int     `gorm:"-" json:"project_count,omitempty"`
}

// OrgMember represents a user's membership and role in an organization.
type OrgMember struct {
	OrgID    string    `gorm:"type:uuid;primaryKey;index" json:"org_id"`
	UserID   string    `gorm:"type:uuid;primaryKey;index" json:"user_id"`
	Role     OrgRole   `gorm:"type:varchar(20);not null;index" json:"role"`
	JoinedAt time.Time `gorm:"not null;autoCreateTime" json:"joined_at"`

	// Relationships
	Organization Organization `gorm:"foreignKey:OrgID;constraint:OnDelete:CASCADE" json:"organization,omitempty"`
	User         User         `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}
