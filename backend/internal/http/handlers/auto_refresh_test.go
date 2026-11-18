package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequireAuth_AutoRefresh_WhenAccessTokenExpired(t *testing.T) {
	h := newHTTPTestHarness(t)

	// 1. Signup a user to create user in DB and generate valid session
	signupBody, _ := json.Marshal(domain.SignupRequest{
		Email:     "autorefresh@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Grace",
		LastName:  "Hopper",
	})
	signupReq := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewReader(signupBody))
	signupReq.Header.Set("Content-Type", "application/json")
	signupResp, err := h.app.Test(signupReq, -1)
	require.NoError(t, err)
	require.Equal(t, fiber.StatusCreated, signupResp.StatusCode)

	var validRefresh string
	for _, c := range signupResp.Cookies() {
		if c.Name == "refresh_token" {
			validRefresh = c.Value
		}
	}
	require.NotEmpty(t, validRefresh, "Signup must provide refresh_token cookie")

	// 2. Mint an explicitly EXPIRED access token for this user
	refreshClaims, err := crypto.ValidateRefreshToken(validRefresh, h.cfg.JWTSecret)
	require.NoError(t, err)

	expiredAccess, _, err := crypto.GenerateAccessToken(
		refreshClaims.Subject,
		refreshClaims.SessionID,
		refreshClaims.Email,
		refreshClaims.IsVerified,
		-10*time.Minute, // Expired 10 minutes ago
		h.cfg.JWTSecret,
	)
	require.NoError(t, err)

	// 3. Make request to protected /v1/auth/me with EXPIRED access token + VALID refresh token cookie
	meReq := httptest.NewRequest("GET", "/v1/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+expiredAccess)
	meReq.AddCookie(&http.Cookie{
		Name:     "access_token",
		Value:    expiredAccess,
		Path:     "/",
		HttpOnly: true,
	})
	meReq.AddCookie(&http.Cookie{
		Name:     "refresh_token",
		Value:    validRefresh,
		Path:     "/",
		HttpOnly: true,
	})

	meResp, err := h.app.Test(meReq, -1)
	require.NoError(t, err)

	// User should NOT be logged out! Status MUST be 200 OK because auto-refresh succeeded!
	assert.Equal(t, fiber.StatusOK, meResp.StatusCode, "Expired access token with valid refresh token must return 200 OK via auto-refresh")

	// X-Access-Token header must be present
	newAccessTokenHeader := meResp.Header.Get("X-Access-Token")
	assert.NotEmpty(t, newAccessTokenHeader, "Auto-refresh must expose new access token in X-Access-Token header")

	// New cookies must be set on the response
	var newAccessCookie, newRefreshCookie, newStrimCookie string
	for _, c := range meResp.Cookies() {
		if c.Name == "access_token" {
			newAccessCookie = c.Value
		}
		if c.Name == "refresh_token" {
			newRefreshCookie = c.Value
		}
		if c.Name == "strim_access_token" {
			newStrimCookie = c.Value
		}
	}
	assert.NotEmpty(t, newAccessCookie, "Must set new access_token cookie")
	assert.NotEmpty(t, newRefreshCookie, "Must set new refresh_token cookie")
	assert.NotEmpty(t, newStrimCookie, "Must set new strim_access_token cookie")
	assert.NotEqual(t, validRefresh, newRefreshCookie, "Refresh token must be rotated to extend the 7-day deadline")

	// 4. Subsequent request with the newly rotated tokens succeeds seamlessly
	subsequentReq := httptest.NewRequest("GET", "/v1/auth/me", nil)
	subsequentReq.Header.Set("Authorization", "Bearer "+newAccessTokenHeader)
	subsequentReq.AddCookie(&http.Cookie{
		Name:     "access_token",
		Value:    newAccessCookie,
		Path:     "/",
		HttpOnly: true,
	})
	subsequentReq.AddCookie(&http.Cookie{
		Name:     "refresh_token",
		Value:    newRefreshCookie,
		Path:     "/",
		HttpOnly: true,
	})

	subsequentResp, err := h.app.Test(subsequentReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, subsequentResp.StatusCode)
}

func TestRequireAuth_AutoRefresh_ExpiredRefreshToken_Returns401(t *testing.T) {
	h := newHTTPTestHarness(t)

	// Signup user
	signupBody, _ := json.Marshal(domain.SignupRequest{
		Email:     "inactive_user@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Ada",
		LastName:  "Lovelace",
	})
	signupReq := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewReader(signupBody))
	signupReq.Header.Set("Content-Type", "application/json")
	signupResp, err := h.app.Test(signupReq, -1)
	require.NoError(t, err)

	var validRefresh string
	for _, c := range signupResp.Cookies() {
		if c.Name == "refresh_token" {
			validRefresh = c.Value
		}
	}

	claims, err := crypto.ValidateRefreshToken(validRefresh, h.cfg.JWTSecret)
	require.NoError(t, err)

	// Generate EXPIRED refresh token (e.g. user was offline for > 7 days)
	expiredRefresh, _, err := crypto.GenerateRefreshToken(
		claims.Subject,
		claims.SessionID,
		claims.Email,
		claims.IsVerified,
		-24*time.Hour, // Expired 1 day ago
		h.cfg.JWTSecret,
	)
	require.NoError(t, err)

	expiredAccess, _, err := crypto.GenerateAccessToken(
		claims.Subject,
		claims.SessionID,
		claims.Email,
		claims.IsVerified,
		-1*time.Hour,
		h.cfg.JWTSecret,
	)
	require.NoError(t, err)

	// User who has been inactive > 7 days makes request
	req := httptest.NewRequest("GET", "/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+expiredAccess)
	req.AddCookie(&http.Cookie{
		Name:     "access_token",
		Value:    expiredAccess,
		Path:     "/",
		HttpOnly: true,
	})
	req.AddCookie(&http.Cookie{
		Name:     "refresh_token",
		Value:    expiredRefresh,
		Path:     "/",
		HttpOnly: true,
	})

	resp, err := h.app.Test(req, -1)
	require.NoError(t, err)

	// MUST return 401 Unauthorized so user is redirected to login
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)

	var res domain.Response
	_ = json.NewDecoder(resp.Body).Decode(&res)
	assert.False(t, res.Success)
	assert.Equal(t, domain.ErrCodeTokenExpired, res.ErrorCode)
}
