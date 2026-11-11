package discovery_test

import (
	"testing"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/stretchr/testify/assert"
)

func TestNormalizeMethod(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"get", "GET"},
		{"POST", "POST"},
		{"  put  ", "PUT"},
		{"delete", "DELETE"},
		{"patch", "PATCH"},
	}

	for _, tt := range tests {
		assert.Equal(t, tt.expected, discovery.NormalizeMethod(tt.input))
	}
}

func TestNormalizePath(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Empty path returns root",
			input:    "",
			expected: "/",
		},
		{
			name:     "Root path stays root",
			input:    "/",
			expected: "/",
		},
		{
			name:     "Static route remains unchanged",
			input:    "/health",
			expected: "/health",
		},
		{
			name:     "Static nested route remains unchanged",
			input:    "/v1/organizations/settings",
			expected: "/v1/organizations/settings",
		},
		{
			name:     "Numeric identifier replaced with {id}",
			input:    "/users/123",
			expected: "/users/{id}",
		},
		{
			name:     "Multiple numeric identifiers replaced",
			input:    "/users/123/orders/456",
			expected: "/users/{id}/orders/{id}",
		},
		{
			name:     "UUIDv4 replaced with {id}",
			input:    "/orders/c9bf9e57-1685-4c89-bafb-ff5af830be8a",
			expected: "/orders/{id}",
		},
		{
			name:     "UUIDv7 replaced with {id}",
			input:    "/orders/018f3a5b-7c91-7b00-8000-000000000001/items",
			expected: "/orders/{id}/items",
		},
		{
			name:     "Hex hash MD5 (32 chars) replaced with {hash}",
			input:    "/files/d41d8cd98f00b204e9800998ecf8427e",
			expected: "/files/{hash}",
		},
		{
			name:     "Hex hash SHA1 (40 chars) replaced with {hash}",
			input:    "/commits/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12",
			expected: "/commits/{hash}",
		},
		{
			name:     "Hex hash SHA256 (64 chars) replaced with {hash}",
			input:    "/blobs/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			expected: "/blobs/{hash}",
		},
		{
			name:     "Prefixed ID (e.g. Stripe customer) replaced with {id}",
			input:    "/customers/cus_NffrFehuTGbhD8",
			expected: "/customers/{id}",
		},
		{
			name:     "Existing template {param} preserved",
			input:    "/users/{userId}/addresses/{addressId}",
			expected: "/users/{userId}/addresses/{addressId}",
		},
		{
			name:     "Colon parameter converted to {param}",
			input:    "/users/:userId/orders/:orderId",
			expected: "/users/{userId}/orders/{orderId}",
		},
		{
			name:     "Full URL with query parameters and fragment",
			input:    "https://api.acme.com/v1/orders/123?sort=desc&limit=10#details",
			expected: "/v1/orders/{id}",
		},
		{
			name:     "Missing leading slash gets normalized",
			input:    "api/v1/products/999",
			expected: "/api/v1/products/{id}",
		},
		{
			name:     "Trailing slash stripped",
			input:    "/v1/organizations/",
			expected: "/v1/organizations",
		},
		{
			name:     "API version prefix v1 not converted to id",
			input:    "/v1/items/42",
			expected: "/v1/items/{id}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := discovery.NormalizePath(tt.input)
			assert.Equal(t, tt.expected, actual)
		})
	}
}
