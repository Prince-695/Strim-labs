package domain

import (
	"time"

	"gorm.io/gorm"
)

// User represents an account holder within STRIM Labs.
type User struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	Email        string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string         `gorm:"type:varchar(255);not null" json:"-"`
	FirstName    string         `gorm:"type:varchar(100);not null" json:"first_name"`
	LastName     string         `gorm:"type:varchar(100);not null" json:"last_name"`
	Username     *string        `gorm:"type:varchar(50);uniqueIndex" json:"username,omitempty"`
	IsVerified   bool           `gorm:"default:false;not null" json:"is_verified"`
	CreatedAt    time.Time      `gorm:"not null;autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"not null;autoUpdateTime" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// RefreshToken stores session rotation tokens with family reuse detection.
type RefreshToken struct {
	ID         string     `gorm:"type:uuid;primaryKey" json:"id"`
	UserID     string     `gorm:"type:uuid;index;not null" json:"user_id"`
	FamilyID   string     `gorm:"type:uuid;index;not null" json:"family_id"`
	TokenHash  string     `gorm:"type:varchar(64);uniqueIndex;not null" json:"-"`
	UserAgent  string     `gorm:"type:text" json:"user_agent"`
	IP         string     `gorm:"type:varchar(45)" json:"ip"`
	ExpiresAt  time.Time  `gorm:"not null;index" json:"expires_at"`
	RevokedAt  *time.Time `gorm:"index" json:"revoked_at,omitempty"`
	ReplacedBy *string    `gorm:"type:varchar(64)" json:"replaced_by,omitempty"`
	CreatedAt  time.Time  `gorm:"not null;autoCreateTime" json:"created_at"`
}

// OTPCode tracks 6-digit numeric codes for email verification and password resets.
type OTPCode struct {
	ID        string     `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    *string    `gorm:"type:uuid;index" json:"user_id,omitempty"`
	Email     string     `gorm:"type:varchar(255);index;not null" json:"email"`
	Purpose   string     `gorm:"type:varchar(50);not null" json:"purpose"` // email_verification, password_reset
	CodeHash  string     `gorm:"type:varchar(64);not null" json:"-"`
	Attempts  int        `gorm:"default:0;not null" json:"attempts"`
	ExpiresAt time.Time  `gorm:"not null;index" json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	CreatedAt time.Time  `gorm:"not null;autoCreateTime" json:"created_at"`
}

// OAuthAccount maps social provider logins (e.g. Google, GitHub) to internal users.
type OAuthAccount struct {
	ID             string    `gorm:"type:uuid;primaryKey" json:"id"`
	Provider       string    `gorm:"type:varchar(50);not null;uniqueIndex:idx_provider_user" json:"provider"`
	ProviderUserID string    `gorm:"type:varchar(255);not null;uniqueIndex:idx_provider_user" json:"provider_user_id"`
	UserID         string    `gorm:"type:uuid;index;not null" json:"user_id"`
	Email          string    `gorm:"type:varchar(255);not null" json:"email"`
	CreatedAt      time.Time `gorm:"not null;autoCreateTime" json:"created_at"`
}
