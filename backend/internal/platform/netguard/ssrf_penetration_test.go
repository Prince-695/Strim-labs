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

type penetrationMockResolver struct {
	records map[string][]net.IP
}

func (m *penetrationMockResolver) LookupIP(ctx context.Context, network, host string) ([]net.IP, error) {
	if ips, ok := m.records[host]; ok {
		return ips, nil
	}
	// Fall back to literal IP parsing if host is an IP
	if ip := net.ParseIP(host); ip != nil {
		return []net.IP{ip}, nil
	}
	return nil, &net.DNSError{Err: "no such host", Name: host}
}

func TestSSRFGuard_PenetrationVectors(t *testing.T) {
	resolver := &penetrationMockResolver{
		records: map[string][]net.IP{
			"valid-public.com":        {net.ParseIP("93.184.216.34")},
			"metadata.aws.internal":   {net.ParseIP("169.254.169.254")},
			"internal-service.local":  {net.ParseIP("10.0.0.5")},
			"vpc-db.corp":             {net.ParseIP("172.20.14.99")},
			"home-router.lan":         {net.ParseIP("192.168.1.1")},
			"cgnat.carrier":           {net.ParseIP("100.64.0.1")},
			"ipv6-loopback.local":     {net.ParseIP("::1")},
			"ipv6-ula.local":          {net.ParseIP("fc00::1")},
			"ipv6-linklocal.local":    {net.ParseIP("fe80::1")},
			"mixed-rebind.attack.com": {net.ParseIP("93.184.216.34"), net.ParseIP("127.0.0.1")}, // Rebinding attack vector
			"cname-loopback.attack":   {net.ParseIP("127.0.0.1")},
			"zero-ip.attack":          {net.ParseIP("0.0.0.0")},
		},
	}

	guard := netguard.NewSSRFGuard(resolver)
	ctx := context.Background()

	tests := []struct {
		name        string
		targetURL   string
		shouldBlock bool
	}{
		// 1. Legitimate Public Target
		{"Valid HTTPS Public Domain", "https://valid-public.com/api/v1", false},
		{"Valid HTTP Public Domain", "http://valid-public.com:8080/health", false},

		// 2. Loopback Attempts (IPv4 & IPv6)
		{"Loopback 127.0.0.1", "http://127.0.0.1/admin", true},
		{"Loopback 127.0.0.2", "http://127.0.0.2:8000/metrics", true},
		{"Loopback 127.255.255.254", "http://127.255.255.254/secret", true},
		{"Loopback 0.0.0.0", "http://0.0.0.0:8080/", true},
		{"IPv6 Loopback [::1]", "http://[::1]:8080/metrics", true},
		{"Hostname resolving to loopback", "http://cname-loopback.attack/status", true},
		{"Hostname resolving to 0.0.0.0", "http://zero-ip.attack/status", true},

		// 3. Cloud Provider Metadata Services (IMDSv1 & IMDSv2)
		{"Cloud Metadata IP 169.254.169.254", "http://169.254.169.254/latest/meta-data/", true},
		{"Cloud Metadata Alternative IP", "http://169.254.169.250/openstack", true},
		{"Hostname resolving to Metadata", "http://metadata.aws.internal/credentials", true},

		// 4. Private RFC 1918 Subnets
		{"Class A Private 10.0.0.5", "http://internal-service.local/api", true},
		{"Class A Direct IP 10.254.0.1", "http://10.254.0.1:9090", true},
		{"Class B Private 172.20.14.99", "http://vpc-db.corp/data", true},
		{"Class B Direct IP 172.16.0.1", "http://172.16.0.1/admin", true},
		{"Class C Private 192.168.1.1", "http://home-router.lan/", true},
		{"Class C Direct IP 192.168.100.50", "http://192.168.100.50/metrics", true},

		// 5. Shared Address Space / CGNAT (RFC 6598)
		{"CGNAT 100.64.0.1", "http://cgnat.carrier/network", true},
		{"CGNAT Direct IP", "http://100.64.12.34:8080", true},

		// 6. IPv6 Private and Local Ranges
		{"IPv6 ULA fc00::1", "http://ipv6-ula.local/internal", true},
		{"IPv6 Link-Local fe80::1", "http://ipv6-linklocal.local/config", true},

		// 7. Multi-IP DNS Rebinding Defense (Public + Private in same record)
		{"DNS Rebind Mixed Public and Private", "http://mixed-rebind.attack.com/status", true},

		// 8. Protocol Smuggling & Disallowed Schemes
		{"File protocol", "file:///etc/passwd", true},
		{"Gopher protocol", "gopher://127.0.0.1:6379/_INFO", true},
		{"FTP protocol", "ftp://valid-public.com/dump.sql", true},
		{"LDAP protocol", "ldap://valid-public.com:389/dc=example", true},
		{"Dict protocol", "dict://127.0.0.1:2628/", true},

		// 9. Malformed & Edge-Case Inputs
		{"Empty string", "", true},
		{"Whitespace only", "   ", true},
		{"No Scheme", "valid-public.com/path", true},
		{"Invalid URL syntax", "http://invalid domain with spaces.com", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsedURL, err := guard.ValidateTargetURL(ctx, tt.targetURL)
			if tt.shouldBlock {
				assert.Error(t, err, "Target URL %q should be blocked", tt.targetURL)
				assert.Nil(t, parsedURL)
				if appErr, ok := err.(*domain.AppError); ok {
					assert.Contains(t, []string{
						domain.ErrCodeTargetBlocked,
						domain.ErrCodeValidationFailed,
						domain.ErrCodeBadRequest,
					}, appErr.ErrorCode)
				}
			} else {
				require.NoError(t, err, "Target URL %q should be allowed", tt.targetURL)
				assert.NotNil(t, parsedURL)
				assert.Equal(t, "valid-public.com", parsedURL.Hostname())
			}
		})
	}
}

func TestSSRFGuard_IsBlockedIPDirect(t *testing.T) {
	guard := netguard.NewSSRFGuard(nil)

	// Blocked IPs
	assert.True(t, guard.IsBlockedIP(net.ParseIP("127.0.0.1")))
	assert.True(t, guard.IsBlockedIP(net.ParseIP("10.0.0.1")))
	assert.True(t, guard.IsBlockedIP(net.ParseIP("172.16.0.1")))
	assert.True(t, guard.IsBlockedIP(net.ParseIP("192.168.1.1")))
	assert.True(t, guard.IsBlockedIP(net.ParseIP("169.254.169.254")))
	assert.True(t, guard.IsBlockedIP(net.ParseIP("::1")))
	assert.True(t, guard.IsBlockedIP(net.ParseIP("0.0.0.0")))
	assert.True(t, guard.IsBlockedIP(nil))

	// Allowed Public IPs
	assert.False(t, guard.IsBlockedIP(net.ParseIP("8.8.8.8")))
	assert.False(t, guard.IsBlockedIP(net.ParseIP("93.184.216.34")))
	assert.False(t, guard.IsBlockedIP(net.ParseIP("1.1.1.1")))
}
