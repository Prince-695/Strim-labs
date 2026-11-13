package crypto_test

import (
	"testing"

	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncryptDecryptAESGCM(t *testing.T) {
	secretKey := "my-super-secret-key-at-least-32-chars-long"
	plaintext := "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload"

	encrypted, err := crypto.EncryptAESGCM(plaintext, secretKey)
	require.NoError(t, err)
	assert.NotEmpty(t, encrypted)
	assert.NotEqual(t, plaintext, encrypted)

	decrypted, err := crypto.DecryptAESGCM(encrypted, secretKey)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decrypted)

	// Wrong key fails
	_, err = crypto.DecryptAESGCM(encrypted, "wrong-key")
	assert.Error(t, err)

	// Empty string roundtrips
	emptyEnc, err := crypto.EncryptAESGCM("", secretKey)
	require.NoError(t, err)
	assert.Empty(t, emptyEnc)

	emptyDec, err := crypto.DecryptAESGCM("", secretKey)
	require.NoError(t, err)
	assert.Empty(t, emptyDec)
}
