package crypto

import (
	"testing"
	"time"
)

func TestArgon2PasswordHashing(t *testing.T) {
	password := "S3cure!password123"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("unexpected error hashing password: %v", err)
	}

	match, err := VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("unexpected error verifying password: %v", err)
	}
	if !match {
		t.Errorf("expected password to match hash")
	}

	wrongMatch, err := VerifyPassword("WrongPassword123!", hash)
	if err != nil {
		t.Fatalf("unexpected error verifying wrong password: %v", err)
	}
	if wrongMatch {
		t.Errorf("expected wrong password not to match hash")
	}
}

func TestPasswordPolicy(t *testing.T) {
	// Too short (< 8)
	if err := ValidatePasswordPolicy("short1!"); err != ErrPasswordTooShort {
		t.Errorf("expected ErrPasswordTooShort, got: %v", err)
	}

	// Too long (> 72)
	longPass := string(make([]byte, 73))
	if err := ValidatePasswordPolicy(longPass); err != ErrPasswordTooLong {
		t.Errorf("expected ErrPasswordTooLong, got: %v", err)
	}

	// Common weak password
	if err := ValidatePasswordPolicy("password123"); err != ErrPasswordCommon {
		t.Errorf("expected ErrPasswordCommon, got: %v", err)
	}

	// Valid password
	if err := ValidatePasswordPolicy("SuperCompl3x!Str1m"); err != nil {
		t.Errorf("expected valid password to pass, got: %v", err)
	}
}

func TestJWTGenerationAndValidation(t *testing.T) {
	secret := "test-super-secret-jwt-key-32-chars-long"
	userID := "0192f1b2-7c1e-7a3b-9d0a-3f5b6c7d8e9f"
	sessionID := "0192f1b2-7c1e-7a3b-9d0a-3f5b6c7d8e90"
	email := "dev@strimlabs.dev"
	isVerified := true

	token, jti, err := GenerateAccessToken(userID, sessionID, email, isVerified, 15*time.Minute, secret)
	if err != nil {
		t.Fatalf("unexpected error generating access token: %v", err)
	}
	if token == "" || jti == "" {
		t.Fatalf("token or jti should not be empty")
	}

	claims, err := ValidateAccessToken(token, secret)
	if err != nil {
		t.Fatalf("unexpected error validating access token: %v", err)
	}

	if claims.Subject != userID {
		t.Errorf("expected subject %q, got %q", userID, claims.Subject)
	}
	if claims.SessionID != sessionID {
		t.Errorf("expected session_id %q, got %q", sessionID, claims.SessionID)
	}
	if claims.Email != email {
		t.Errorf("expected email %q, got %q", email, claims.Email)
	}
	if claims.IsVerified != isVerified {
		t.Errorf("expected is_verified %v, got %v", isVerified, claims.IsVerified)
	}
	if claims.ID != jti {
		t.Errorf("expected claims.ID to equal jti %q, got %q", jti, claims.ID)
	}

	// Test invalid secret
	_, err = ValidateAccessToken(token, "wrong-secret-key-that-does-not-match")
	if err == nil {
		t.Errorf("expected validation to fail with wrong secret")
	}

	// Test expired token
	expiredToken, _, err := GenerateAccessToken(userID, sessionID, email, isVerified, -1*time.Minute, secret)
	if err != nil {
		t.Fatalf("failed to generate expired token: %v", err)
	}
	_, err = ValidateAccessToken(expiredToken, secret)
	if err != ErrExpiredToken {
		t.Errorf("expected ErrExpiredToken, got: %v", err)
	}
}

func TestRandomTokenAndOTP(t *testing.T) {
	// Opaque Token
	raw, hash, err := GenerateOpaqueToken()
	if err != nil {
		t.Fatalf("unexpected error generating opaque token: %v", err)
	}
	if len(raw) != 64 {
		t.Errorf("expected 64 hex chars, got %d", len(raw))
	}
	if HashToken(raw) != hash {
		t.Errorf("expected HashToken(raw) to match hash")
	}

	// OTP
	code, otpHash, err := GenerateOTP()
	if err != nil {
		t.Fatalf("unexpected error generating OTP: %v", err)
	}
	if len(code) != 6 {
		t.Errorf("expected 6-digit OTP, got %s (len %d)", code, len(code))
	}
	if HashToken(code) != otpHash {
		t.Errorf("expected HashToken(code) to match otpHash")
	}
}
