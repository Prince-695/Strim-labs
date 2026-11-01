package crypto

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken   = errors.New("invalid or malformed authorization token")
	ErrExpiredToken   = errors.New("authorization token has expired")
	ErrTokenAlgorithm = errors.New("unexpected signing algorithm")
)

// JWTClaims holds custom application claims along with standard registered claims.
type JWTClaims struct {
	SessionID  string `json:"sid"`
	Email      string `json:"email"`
	IsVerified bool   `json:"is_verified"`
	jwt.RegisteredClaims
}

// GenerateAccessToken signs a new JWT access token with the given claims and secret.
func GenerateAccessToken(userID, sessionID, email string, isVerified bool, ttl time.Duration, secret string) (string, string, error) {
	if secret == "" {
		return "", "", errors.New("jwt secret key cannot be empty")
	}

	jti := uuid.New().String()
	now := time.Now().UTC()

	claims := JWTClaims{
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
		return "", "", fmt.Errorf("failed to sign jwt access token: %w", err)
	}

	return signed, jti, nil
}

// ValidateAccessToken parses and validates an HMAC-signed JWT access token.
func ValidateAccessToken(tokenStr, secret string) (*JWTClaims, error) {
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

	return claims, nil
}
