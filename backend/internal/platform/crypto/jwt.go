package crypto

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken     = errors.New("invalid or malformed authorization token")
	ErrExpiredToken     = errors.New("authorization token has expired")
	ErrTokenAlgorithm   = errors.New("unexpected signing algorithm")
	ErrInvalidTokenType = errors.New("invalid or unexpected token type")
)

const (
	TokenTypeAccess  = "access"
	TokenTypeRefresh = "refresh"
)

// JWTClaims holds custom application claims along with standard registered claims.
type JWTClaims struct {
	TokenType  string `json:"token_type"`
	SessionID  string `json:"sid,omitempty"`
	Email      string `json:"email"`
	IsVerified bool   `json:"is_verified"`
	jwt.RegisteredClaims
}

// GenerateAccessToken signs a short-lived JWT access token with token_type="access".
func GenerateAccessToken(userID, sessionID, email string, isVerified bool, ttl time.Duration, secret string) (string, string, error) {
	return GenerateToken(TokenTypeAccess, userID, sessionID, email, isVerified, ttl, secret)
}

// GenerateRefreshToken signs a long-lived JWT refresh token with token_type="refresh".
func GenerateRefreshToken(userID, sessionID, email string, isVerified bool, ttl time.Duration, secret string) (string, string, error) {
	return GenerateToken(TokenTypeRefresh, userID, sessionID, email, isVerified, ttl, secret)
}

// GenerateToken signs a new JWT token with the specified token_type and claims.
func GenerateToken(tokenType, userID, sessionID, email string, isVerified bool, ttl time.Duration, secret string) (string, string, error) {
	if secret == "" {
		return "", "", errors.New("jwt secret key cannot be empty")
	}

	jti := uuid.New().String()
	now := time.Now().UTC()

	claims := JWTClaims{
		TokenType:  tokenType,
		SessionID:  sessionID,
		Email:      email,
		IsVerified: isVerified,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ID:        jti,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			Issuer:    "strim-labs",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", "", fmt.Errorf("failed to sign jwt %s token: %w", tokenType, err)
	}

	return signed, jti, nil
}

// ValidateToken parses and validates an HMAC-signed JWT token and checks the mandatory token_type claim.
func ValidateToken(tokenStr, secret, expectedType string) (*JWTClaims, error) {
	if tokenStr == "" {
		return nil, ErrInvalidToken
	}
	if secret == "" {
		return nil, errors.New("jwt secret key cannot be empty")
	}

	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("%w: %v", ErrTokenAlgorithm, t.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	if expectedType != "" && claims.TokenType != expectedType {
		return nil, fmt.Errorf("%w: expected token_type %q, got %q", ErrInvalidTokenType, expectedType, claims.TokenType)
	}

	return claims, nil
}

// ValidateAccessToken parses and validates that the token is a valid, unexpired access token.
func ValidateAccessToken(tokenStr, secret string) (*JWTClaims, error) {
	return ValidateToken(tokenStr, secret, TokenTypeAccess)
}

// ValidateRefreshToken parses and validates that the token is a valid, unexpired refresh token.
func ValidateRefreshToken(tokenStr, secret string) (*JWTClaims, error) {
	return ValidateToken(tokenStr, secret, TokenTypeRefresh)
}
