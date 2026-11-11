package service_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockDNSTXTResolver struct {
	records map[string][]string
	err     error
}

func (m *mockDNSTXTResolver) LookupTXT(ctx context.Context, name string) ([]string, error) {
	if m.err != nil {
		return nil, m.err
	}
	if recs, ok := m.records[name]; ok {
		return recs, nil
	}
	return nil, errors.New("no such host")
}

type mockHTTPFetcher struct {
	content map[string]string
	err     error
}

func (m *mockHTTPFetcher) FetchWellKnownFile(ctx context.Context, targetURL string) (string, error) {
	if m.err != nil {
		return "", m.err
	}
	if c, ok := m.content[targetURL]; ok {
		return c, nil
	}
	return "", errors.New("404 not found")
}

func TestVerificationEngine_GenerateToken(t *testing.T) {
	engine := service.NewVerificationEngine(nil, nil)
	token1 := engine.GenerateToken()
	token2 := engine.GenerateToken()

	require.NotEmpty(t, token1)
	require.NotEmpty(t, token2)
	assert.NotEqual(t, token1, token2)
	assert.Equal(t, 32, len(token1)) // 16 bytes hex-encoded = 32 chars
}

func TestVerificationEngine_BuildInstructions(t *testing.T) {
	engine := service.NewVerificationEngine(nil, nil)
	token := "abcdef1234567890abcdef1234567890"

	instructions := engine.BuildInstructions("https://api.acme.com", token)

	assert.Equal(t, "TXT", instructions.DNS.Type)
	assert.Equal(t, "_strim.api.acme.com", instructions.DNS.Host)
	assert.Equal(t, "strim-verify=abcdef1234567890abcdef1234567890", instructions.DNS.Value)

	assert.Equal(t, "https://api.acme.com/.well-known/strim-verify.txt", instructions.File.URL)
	assert.Equal(t, token, instructions.File.Content)
}

func TestVerificationEngine_VerifyDNS(t *testing.T) {
	token := "abcdef1234567890abcdef1234567890"
	expectedVal := "strim-verify=" + token

	mockDNS := &mockDNSTXTResolver{
		records: map[string][]string{
			"_strim.valid.com": {expectedVal},
			"_strim.apex.com":  {"some-other-txt"},
			"apex.com":         {expectedVal},
			"_strim.wrong.com": {"strim-verify=wrongtoken"},
		},
	}

	engine := service.NewVerificationEngine(mockDNS, nil)
	ctx := context.Background()

	t.Run("Subdomain TXT match", func(t *testing.T) {
		verified, reason := engine.VerifyDNS(ctx, "https://valid.com", token)
		assert.True(t, verified)
		assert.Empty(t, reason)
	})

	t.Run("Apex TXT fallback match", func(t *testing.T) {
		verified, reason := engine.VerifyDNS(ctx, "https://apex.com", token)
		assert.True(t, verified)
		assert.Empty(t, reason)
	})

	t.Run("Mismatch value", func(t *testing.T) {
		verified, reason := engine.VerifyDNS(ctx, "https://wrong.com", token)
		assert.False(t, verified)
		assert.Contains(t, reason, "TXT record found but value did not match")
	})

	t.Run("Record not found", func(t *testing.T) {
		verified, reason := engine.VerifyDNS(ctx, "https://missing.com", token)
		assert.False(t, verified)
		assert.Contains(t, reason, "No TXT records found")
	})
}

func TestVerificationEngine_VerifyHTTP(t *testing.T) {
	token := "abcdef1234567890abcdef1234567890"

	mockHTTP := &mockHTTPFetcher{
		content: map[string]string{
			"https://valid.com/.well-known/strim-verify.txt":    token + "\n",
			"https://prefixed.com/.well-known/strim-verify.txt": "strim-verify=" + token,
			"https://wrong.com/.well-known/strim-verify.txt":    "different-token",
		},
	}

	engine := service.NewVerificationEngine(nil, mockHTTP)
	ctx := context.Background()

	t.Run("Exact token content match", func(t *testing.T) {
		verified, reason := engine.VerifyHTTP(ctx, "https://valid.com", token)
		assert.True(t, verified)
		assert.Empty(t, reason)
	})

	t.Run("Prefixed strim-verify= content match", func(t *testing.T) {
		verified, reason := engine.VerifyHTTP(ctx, "https://prefixed.com", token)
		assert.True(t, verified)
		assert.Empty(t, reason)
	})

	t.Run("Content mismatch", func(t *testing.T) {
		verified, reason := engine.VerifyHTTP(ctx, "https://wrong.com", token)
		assert.False(t, verified)
		assert.Contains(t, reason, "File content mismatch")
	})

	t.Run("Fetch error 404", func(t *testing.T) {
		verified, reason := engine.VerifyHTTP(ctx, "https://missing.com", token)
		assert.False(t, verified)
		assert.True(t, strings.HasPrefix(reason, "Failed to fetch"))
	})
}
