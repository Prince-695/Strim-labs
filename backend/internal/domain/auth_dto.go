package domain

import "time"

// SignupRequest payload for creating a new user account.
type SignupRequest struct {
	Email     string `json:"email" validate:"required,email" example:"dev@acme.com"`
	Password  string `json:"password" validate:"required,min=8,max=72" example:"S3cure!pass"`
	FirstName string `json:"first_name" validate:"required,min=1,max=100" example:"Asha"`
	LastName  string `json:"last_name" validate:"required,min=1,max=100" example:"Patel"`
}

// LoginRequest payload for authenticating with email and password.
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email" example:"dev@acme.com"`
	Password string `json:"password" validate:"required" example:"S3cure!pass"`
}

// RefreshRequest payload for rotating a refresh token via body.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token,omitempty" example:"d7a8b9c0..."`
}

// ForgotPasswordRequest triggers sending an OTP to the given email.
type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email" example:"dev@acme.com"`
}

// ResetPasswordRequest verifies the OTP and sets a new password across all sessions.
type ResetPasswordRequest struct {
	Email       string `json:"email" validate:"required,email" example:"dev@acme.com"`
	OTP         string `json:"otp" validate:"required,len=6" example:"123456"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=72" example:"N3wS3cure!pass"`
}

// ChangePasswordRequest rotates password for authenticated caller.
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required" example:"S3cure!pass"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=72" example:"N3wS3cure!pass"`
}

// VerifyOTPRequest verifies email verification code.
type VerifyOTPRequest struct {
	OTP string `json:"otp" validate:"required,len=6" example:"123456"`
}

// UserResponse sanitized user representation.
type UserResponse struct {
	ID         string    `json:"id" example:"0192f1b2-7c1e-7a3b-9d0a-3f5b6c7d8e9f"`
	Email      string    `json:"email" example:"dev@acme.com"`
	FirstName  string    `json:"first_name" example:"Asha"`
	LastName   string    `json:"last_name" example:"Patel"`
	Username   *string   `json:"username,omitempty" example:"asha"`
	IsVerified bool      `json:"is_verified" example:"true"`
	CreatedAt  time.Time `json:"created_at" example:"2026-11-01T10:00:00Z"`
}

// ToUserResponse converts a database User model into sanitized UserResponse.
func ToUserResponse(u *User) UserResponse {
	return UserResponse{
		ID:         u.ID,
		Email:      u.Email,
		FirstName:  u.FirstName,
		LastName:   u.LastName,
		Username:   u.Username,
		IsVerified: u.IsVerified,
		CreatedAt:  u.CreatedAt,
	}
}

// AuthResponseData envelope containing user and opaque refresh token.
type AuthResponseData struct {
	User         UserResponse `json:"user"`
	RefreshToken string       `json:"refresh_token,omitempty" example:"d7a8b9c0..."`
}

// AuthMeResponseData payload returned by GET /v1/auth/me.
type AuthMeResponseData struct {
	User       UserResponse `json:"user"`
	IsVerified bool         `json:"is_verified"`
	SessionID  string       `json:"session_id"`
	ExpiresAt  time.Time    `json:"expires_at"`
}

// SessionResponse item for active session list.
type SessionResponse struct {
	ID        string    `json:"id"`
	UserAgent string    `json:"user_agent"`
	IP        string    `json:"ip"`
	CreatedAt time.Time `json:"created_at"`
	IsCurrent bool      `json:"current"`
}

// OAuthLoginResponse payload containing OAuth authorization redirect URL.
type OAuthLoginResponse struct {
	URL string `json:"url" example:"https://accounts.google.com/o/oauth2/auth?..."`
}
