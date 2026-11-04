package netguard_test

import (
	"context"
	"net"
	"testing"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockResolver struct {
	ips map[string][]net.IP
	err error
}

func (m *mockResolver) LookupIP(ctx context.Context, network, host string) ([]net.IP, error) {
	if m.err != nil {
		return nil, m.err
	}
	if ips, ok := m.ips[host]; ok {
		return ips, nil
	}
	return nil, &net.DNSError{Err: "no such host", Name: host}
}

func TestSSRFGuard_IsBlockedIP(t *testing.T) {
	guard := netguard.NewSSRFGuard(nil)

	tests := []struct {
		name    string
		ip      string
		blocked bool
	}{
		{"IPv4 Loopback", "127.0.0.1", true},
		{"IPv4 Loopback 127.0.0.2", "127.0.0.2", true},
		{"IPv4 Private 10.x", "10.10.10.10", true},
		{"IPv4 Private 172.16.x", "172.16.0.1", true},
		{"IPv4 Private 192.168.x", "192.168.1.1", true},
		{"IPv4 Link-Local", "169.254.1.1", true},
		{"AWS Metadata", "169.254.169.254", true},
		{"IPv4 CGNAT", "100.64.0.1", true},
		{"IPv6 Loopback", "::1", true},
		{"IPv6 Unique Local", "fc00::1", true},
		{"IPv6 Link-Local", "fe80::1", true},
		{"Public Cloudflare DNS", "1.1.1.1", false},
		{"Public Google DNS", "8.8.8.8", false},
		{"Public Anycast", "93.184.216.34", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed := net.ParseIP(tt.ip)
			require.NotNil(t, parsed, "failed to parse test IP")
			assert.Equal(t, tt.blocked, guard.IsBlockedIP(parsed))
		})
	}
}

func TestSSRFGuard_ValidateTargetURL(t *testing.T) {
	mockRes := &mockResolver{
		ips: map[string][]net.IP{
			"api.acme.com":   {net.ParseIP("93.184.216.34")},
			"internal.corp":  {net.ParseIP("10.0.0.5")},
			"metadata.spoof": {net.ParseIP("169.254.169.254")},
			"multi.mixed":    {net.ParseIP("93.184.216.34"), net.ParseIP("127.0.0.1")},
		},
	}

	guard := netguard.NewSSRFGuard(mockRes)
	ctx := context.Background()

	t.Run("Valid public URL", func(t *testing.T) {
		u, err := guard.ValidateTargetURL(ctx, "https://api.acme.com/v1")
		require.NoError(t, err)
		assert.Equal(t, "api.acme.com", u.Hostname())
	})

	t.Run("Valid public IP literal", func(t *testing.T) {
		u, err := guard.ValidateTargetURL(ctx, "http://93.184.216.34:8080/api")
		require.NoError(t, err)
		assert.Equal(t, "93.184.216.34", u.Hostname())
	})

	t.Run("Reject invalid scheme", func(t *testing.T) {
		_, err := guard.ValidateTargetURL(ctx, "ftp://api.acme.com")
		require.Error(t, err)
		var appErr *domain.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, domain.ErrCodeBadRequest, appErr.ErrorCode)
	})

	t.Run("Reject user credentials", func(t *testing.T) {
		_, err := guard.ValidateTargetURL(ctx, "https://user:pass@api.acme.com")
		require.Error(t, err)
		var appErr *domain.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, domain.ErrCodeBadRequest, appErr.ErrorCode)
	})

	t.Run("Reject loopback IP literal", func(t *testing.T) {
		_, err := guard.ValidateTargetURL(ctx, "http://127.0.0.1:8080")
		require.Error(t, err)
		var appErr *domain.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, domain.ErrCodeTargetBlocked, appErr.ErrorCode)
		assert.Equal(t, 422, appErr.HTTPStatus)
	})

	t.Run("Reject localhost hostname", func(t *testing.T) {
		_, err := guard.ValidateTargetURL(ctx, "http://localhost:8080")
		require.Error(t, err)
		var appErr *domain.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, domain.ErrCodeTargetBlocked, appErr.ErrorCode)
	})

	t.Run("Reject private IP resolved hostname", func(t *testing.T) {
		_, err := guard.ValidateTargetURL(ctx, "https://internal.corp/api")
		require.Error(t, err)
		var appErr *domain.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, domain.ErrCodeTargetBlocked, appErr.ErrorCode)
	})

	t.Run("Reject cloud metadata resolved hostname", func(t *testing.T) {
		_, err := guard.ValidateTargetURL(ctx, "http://metadata.spoof/latest/meta-data")
		require.Error(t, err)
		var appErr *domain.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, domain.ErrCodeTargetBlocked, appErr.ErrorCode)
	})

	t.Run("Reject mixed resolution containing private IP", func(t *testing.T) {
		_, err := guard.ValidateTargetURL(ctx, "https://multi.mixed")
		require.Error(t, err)
		var appErr *domain.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, domain.ErrCodeTargetBlocked, appErr.ErrorCode)
	})
}
