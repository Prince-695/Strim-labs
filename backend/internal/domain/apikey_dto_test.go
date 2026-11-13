package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAPIKey_IsActiveAndScopes(t *testing.T) {
	now := time.Now()
	past := now.Add(-1 * time.Hour)
	future := now.Add(1 * time.Hour)

	key := &APIKey{
		ID:        "key-1",
		Prefix:    "strim_live_abcd",
		KeyHash:   HashSecret("secret-val"),
		Scopes:    StringArray{string(ScopeIngest), string(ScopeDiscovery)},
		CreatedAt: past,
	}

	assert.True(t, key.IsActive(now))
	assert.True(t, key.HasScope(ScopeIngest))
	assert.True(t, key.HasScope(ScopeDiscovery))
	assert.False(t, key.HasScope(ScopeRead))

	// Expired key
	key.ExpiresAt = &past
	assert.False(t, key.IsActive(now))

	// Active future expiry
	key.ExpiresAt = &future
	assert.True(t, key.IsActive(now))

	// Grace period expired
	key.GraceUntil = &past
	assert.False(t, key.IsActive(now))

	// Revoked key
	key.GraceUntil = nil
	key.RevokedAt = &past
	assert.False(t, key.IsActive(now))
}

func TestAPIKey_StringArrayDriver(t *testing.T) {
	arr := StringArray{"ingest", "discovery"}
	val, err := arr.Value()
	require.NoError(t, err)

	var restored StringArray
	err = restored.Scan(val)
	require.NoError(t, err)
	assert.Equal(t, arr, restored)

	// Test nil and empty
	var nilArr StringArray
	nVal, err := nilArr.Value()
	require.NoError(t, err)
	assert.Equal(t, "[]", nVal)

	err = restored.Scan(nil)
	require.NoError(t, err)
	assert.Empty(t, restored)
}

func TestCreateAPIKeyRequest_Validate(t *testing.T) {
	req := &CreateAPIKeyRequest{
		Name:   "Prod Ingest Key",
		Scopes: []string{"ingest", "discovery"},
	}
	assert.Nil(t, req.Validate())

	// Empty name
	req.Name = ""
	assert.NotNil(t, req.Validate())

	// Empty scopes
	req.Name = "Valid Name"
	req.Scopes = nil
	assert.NotNil(t, req.Validate())

	// Invalid scope
	req.Scopes = []string{"superadmin"}
	assert.NotNil(t, req.Validate())
}

func TestToAPIKeyResponse(t *testing.T) {
	key := &APIKey{
		ID:        "key-123",
		ProjectID: "proj-1",
		Name:      "CI Key",
		Prefix:    "strim_live_1234",
		Scopes:    StringArray{"ingest"},
		CreatedAt: time.Now(),
	}

	// Without secret
	resp1 := ToAPIKeyResponse(key, "")
	assert.Equal(t, "key-123", resp1.ID)
	assert.Empty(t, resp1.Secret)
	assert.Empty(t, resp1.Message)

	// With secret
	resp2 := ToAPIKeyResponse(key, "strim_live_1234fullsecret")
	assert.Equal(t, "strim_live_1234fullsecret", resp2.Secret)
	assert.Contains(t, resp2.Message, "Copy this key now")
}
