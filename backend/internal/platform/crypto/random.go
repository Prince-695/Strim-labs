package crypto

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
)

// GenerateOpaqueToken generates a cryptographically secure 64-character hex token and its SHA-256 hash.
func GenerateOpaqueToken() (string, string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", fmt.Errorf("failed to generate secure random bytes: %w", err)
	}
	raw := hex.EncodeToString(bytes)
	hash := HashToken(raw)
	return raw, hash, nil
}

// GenerateOTP generates a 6-digit cryptographically secure numeric OTP string and its SHA-256 hash.
func GenerateOTP() (string, string, error) {
	maxVal := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, maxVal)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate secure random OTP: %w", err)
	}
	code := fmt.Sprintf("%06d", n.Int64())
	hash := HashToken(code)
	return code, hash, nil
}

// HashToken computes the SHA-256 hex digest of any input string.
func HashToken(raw string) string {
	digest := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(digest[:])
}
