package domain

import (
	"time"

	"gorm.io/gorm"
)

// User represents an account holder within STRIM Labs.
type User struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	Email           string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash    string         `gorm:"type:varchar(255)" json:"-"`
	FirstName       string         `gorm:"type:varchar(100);not null" json:"first_name"`
	LastName        string         `gorm:"type:varchar(100);not null" json:"last_name"`
	Username        *string        `gorm:"type:varchar(50);uniqueIndex" json:"username,omitempty"`
	OAuthProvider   *string        `gorm:"type:varchar(50);index:idx_user_oauth" json:"oauth_provider,omitempty"`
	OAuthProviderID *string        `gorm:"type:varchar(255);index:idx_user_oauth" json:"oauth_provider_id,omitempty"`
	IsVerified      bool           `gorm:"default:false;not null" json:"is_verified"`
	CreatedAt       time.Time      `gorm:"not null;autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time      `gorm:"not null;autoUpdateTime" json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
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

// TableName explicitly overrides GORM pluralization to map OTPCode to the 'otp' table.
func (OTPCode) TableName() string {
	return "otp"
}

// OTP is an alias for OTPCode.
type OTP = OTPCode

