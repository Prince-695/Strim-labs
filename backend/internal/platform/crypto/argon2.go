package crypto

import (
	"errors"
	"strings"

	"github.com/alexedwards/argon2id"
)

var (
	ErrPasswordTooShort = errors.New("password must be at least 8 characters long")
	ErrPasswordTooLong  = errors.New("password cannot exceed 72 characters")
	ErrPasswordCommon   = errors.New("password is too common or easily guessable")
)

// Default OWASP-compliant Argon2id parameters
var DefaultArgon2Params = &argon2id.Params{
	Memory:      64 * 1024, // 64 MB
	Iterations:  3,
	Parallelism: 2,
	SaltLength:  16,
	KeyLength:   32,
}

var commonPasswords = map[string]struct{}{
	"password":    {},
	"password1":   {},
	"password123": {},
	"12345678":    {},
	"123456789":   {},
	"qwerty123":   {},
	"strim1234":   {},
	"admin1234":   {},
	"letmein12":   {},
	"welcome12":   {},
}

// ValidatePasswordPolicy checks minimum length, maximum length, and common weak passwords.
func ValidatePasswordPolicy(password string) error {
	trimmed := strings.ToLower(strings.TrimSpace(password))
	if len(trimmed) < 8 {
		return ErrPasswordTooShort
	}
	if len(trimmed) > 72 {
		return ErrPasswordTooLong
	}
	if _, found := commonPasswords[trimmed]; found {
		return ErrPasswordCommon
	}
	return nil
}

// HashPassword hashes a plain-text password using Argon2id.
func HashPassword(password string) (string, error) {
	if err := ValidatePasswordPolicy(password); err != nil {
		return "", err
	}
	return argon2id.CreateHash(password, DefaultArgon2Params)
}

// VerifyPassword checks if a plain-text password matches the stored Argon2id hash.
func VerifyPassword(password, hash string) (bool, error) {
	match, err := argon2id.ComparePasswordAndHash(password, hash)
	if err != nil {
		return false, err
	}
	return match, nil
}
