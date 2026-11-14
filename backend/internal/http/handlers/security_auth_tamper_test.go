package handlers_test

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSecurity_AuthTamperingAndCSRFDefenses(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	targetEndpoint := fmt.Sprintf("/v1/organizations/%s/projects", tc.orgID)

	t.Run("Alg_None_Attack_Rejected", func(t *testing.T) {
		// Attempting 'alg: none' JWT signature bypass
		header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
		claimsPayload := base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf(`{
			"token_type": "access",
			"sub": "usr-attacker",
			"email": "attacker@evil.corp",
			"sid": "sess-fake",
			"is_verified": true,
			"exp": %d
		}`, time.Now().Add(1*time.Hour).Unix())))

		unsignedToken := header + "." + claimsPayload + "."

		req := httptest.NewRequest("GET", targetEndpoint, nil)
		req.Header.Set("Authorization", "Bearer "+unsignedToken)

		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Forged_Secret_Signature_Rejected", func(t *testing.T) {
		// Signed with an untrusted forged secret
		forgedClaims := crypto.JWTClaims{
			TokenType:  crypto.TokenTypeAccess,
			SessionID:  "sess-fake",
			Email:      "attacker@evil.corp",
			IsVerified: true,
			RegisteredClaims: jwt.RegisteredClaims{
				Subject:   "usr-attacker",
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
				ID:        "fake-jti-123",
			},
		}

		forgedToken := jwt.NewWithClaims(jwt.SigningMethodHS256, forgedClaims)
		tokenStr, err := forgedToken.SignedString([]byte("evil-forged-secret-not-strim-secret"))
		require.NoError(t, err)

		req := httptest.NewRequest("GET", targetEndpoint, nil)
		req.Header.Set("Authorization", "Bearer "+tokenStr)

		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Expired_Token_Rejected_With_Code", func(t *testing.T) {
		expiredClaims := crypto.JWTClaims{
			TokenType:  crypto.TokenTypeAccess,
			SessionID:  "sess-expired",
			Email:      "owner@loadtest.dev",
			IsVerified: true,
			RegisteredClaims: jwt.RegisteredClaims{
				Subject:   "usr-lt-owner",
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)), // Expired 1 hour ago
				IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
				ID:        "expired-jti-456",
			},
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims)
		tokenStr, err := token.SignedString([]byte(tc.rig.cfg.JWTSecret))
		require.NoError(t, err)

		req := httptest.NewRequest("GET", targetEndpoint, nil)
		req.Header.Set("Authorization", "Bearer "+tokenStr)

		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Malformed_Corrupted_Token_Rejected", func(t *testing.T) {
		malformedTokens := []string{
			"Bearer not-a-real-token",
			"Bearer eyJhbGciOiJIUzI1NiJ9.malformed.signature",
			"Bearer ",
			"Token some-other-token-type",
		}

		for _, mt := range malformedTokens {
			req := httptest.NewRequest("GET", targetEndpoint, nil)
			req.Header.Set("Authorization", mt)

			resp, err := tc.rig.app.Test(req)
			require.NoError(t, err)
			assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
		}
	})

	t.Run("Cookie_Auth_Without_Origin_Header_Rejected", func(t *testing.T) {
		validToken := tc.tokens["owner"]

		body := []byte(`{"name":"CSRF Exploit Project","slug":"csrf-exploit","base_url":"https://api.acme.com"}`)
		req := httptest.NewRequest("POST", targetEndpoint, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{
			Name:  "access_token",
			Value: validToken,
		})
		// Omitting Origin header!

		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	})

	t.Run("Cookie_Auth_With_Untrusted_Origin_Header_Rejected", func(t *testing.T) {
		validToken := tc.tokens["owner"]

		body := []byte(`{"name":"CSRF Exploit Project 2","slug":"csrf-exploit-2","base_url":"https://api.acme.com"}`)
		req := httptest.NewRequest("POST", targetEndpoint, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{
			Name:  "access_token",
			Value: validToken,
		})
		req.Header.Set("Origin", "https://attacker-controlled-site.com") // Untrusted Origin!

		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	})

	t.Run("Cookie_Auth_With_Trusted_Origin_Header_Allowed", func(t *testing.T) {
		validToken := tc.tokens["owner"]

		body := []byte(`{"name":"CSRF Valid Project","slug":"csrf-valid-proj","base_url":"https://api.acme.com"}`)
		req := httptest.NewRequest("POST", targetEndpoint, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{
			Name:  "access_token",
			Value: validToken,
		})
		req.Header.Set("Origin", "http://localhost:3000") // Trusted Origin!

		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
	})
}
