package netguard

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

var (
	blockedCIDRStrings = []string{
		"0.0.0.0/8",          // Current network
		"10.0.0.0/8",         // RFC 1918 Private
		"100.64.0.0/10",      // Shared Address Space (CGNAT)
		"127.0.0.0/8",        // Loopback
		"169.254.0.0/16",     // Link-Local (includes 169.254.169.254)
		"172.16.0.0/12",      // RFC 1918 Private
		"192.0.0.0/24",       // IETF Protocol Assignments
		"192.0.2.0/24",       // TEST-NET-1
		"192.88.99.0/24",     // 6to4 Relay Anycast
		"192.168.0.0/16",     // RFC 1918 Private
		"198.18.0.0/15",      // Network benchmark tests
		"198.51.100.0/24",    // TEST-NET-2
		"203.0.113.0/24",     // TEST-NET-3
		"224.0.0.0/4",        // Multicast
		"240.0.0.0/4",        // Reserved
		"255.255.255.255/32", // Limited Broadcast
		"::/128",             // Unspecified IPv6
		"::1/128",            // Loopback IPv6
		"fc00::/7",           // Unique Local IPv6
		"fe80::/10",          // Link-local IPv6
		"ff00::/8",           // Multicast IPv6
	}

	initOnce     sync.Once
	parsedBlocks []*net.IPNet
)

func initBlockedBlocks() {
	initOnce.Do(func() {
		for _, cidr := range blockedCIDRStrings {
			_, block, err := net.ParseCIDR(cidr)
			if err == nil {
				parsedBlocks = append(parsedBlocks, block)
			}
		}
	})
}

// Resolver defines an interface for resolving hostnames to IP addresses.
type Resolver interface {
	LookupIP(ctx context.Context, network, host string) ([]net.IP, error)
}

// DefaultResolver uses Go's standard net.DefaultResolver.
type DefaultResolver struct{}

func (r *DefaultResolver) LookupIP(ctx context.Context, network, host string) ([]net.IP, error) {
	return net.DefaultResolver.LookupIP(ctx, network, host)
}

// SSRFGuard provides target URL validation and IP blocking capabilities.
type SSRFGuard struct {
	resolver Resolver
}

// NewSSRFGuard creates a new SSRF protection guard.
func NewSSRFGuard(resolver Resolver) *SSRFGuard {
	initBlockedBlocks()
	if resolver == nil {
		resolver = &DefaultResolver{}
	}
	return &SSRFGuard{resolver: resolver}
}

// IsBlockedIP verifies if an IP belongs to private, loopback, link-local, or cloud metadata ranges.
func (g *SSRFGuard) IsBlockedIP(ip net.IP) bool {
	initBlockedBlocks()
	if ip == nil {
		return true
	}

	// Normalise IPv4-mapped IPv6 addresses
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}

	for _, block := range parsedBlocks {
		if block.Contains(ip) {
			return true
		}
	}
	return false
}

// ValidateTargetURL validates scheme, credentials, hostnames, and resolves IPs to guard against SSRF.
func (g *SSRFGuard) ValidateTargetURL(ctx context.Context, rawURL string) (*url.URL, error) {
	initBlockedBlocks()

	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return nil, domain.NewBadRequestError("Target URL cannot be empty", nil)
	}

	u, err := url.ParseRequestURI(trimmed)
	if err != nil {
		return nil, domain.NewBadRequestError("Invalid target URL format", err)
	}

	// 1. Enforce scheme: only http or https
	scheme := strings.ToLower(u.Scheme)
	if scheme != "http" && scheme != "https" {
		return nil, domain.NewBadRequestError("Target URL scheme must be http or https", nil)
	}

	// 2. Reject embedded user credentials
	if u.User != nil {
		return nil, domain.NewBadRequestError("Target URL must not contain embedded user credentials", nil)
	}

	// 3. Extract and validate hostname
	host := u.Hostname()
	if host == "" {
		return nil, domain.NewBadRequestError("Target URL missing valid hostname", nil)
	}

	// Check for obvious loopback / private patterns in host string
	lowerHost := strings.ToLower(host)
	if lowerHost == "localhost" || strings.HasSuffix(lowerHost, ".localhost") ||
		strings.HasSuffix(lowerHost, ".local") || strings.HasSuffix(lowerHost, ".internal") ||
		strings.HasSuffix(lowerHost, ".lan") {
		return nil, domain.NewTargetBlockedError(fmt.Sprintf("host %q is a reserved internal domain", host))
	}

	// 4. If host is an IP address literal, check directly
	if ip := net.ParseIP(host); ip != nil {
		if g.IsBlockedIP(ip) {
			return nil, domain.NewTargetBlockedError(fmt.Sprintf("IP address %s is in a private or blocked range", ip.String()))
		}
		return u, nil
	}

	// 5. Resolve host to IP addresses
	resolveCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	ips, err := g.resolver.LookupIP(resolveCtx, "ip", host)
	if err != nil {
		// If resolver fails in offline sandbox or environment, we check whether it's a test environment
		// For safety, unless explicitly handled by a mock resolver, unresolvable hosts are blocked
		return nil, domain.NewTargetBlockedError(fmt.Sprintf("target host %q could not be resolved or reached: %v", host, err))
	}

	if len(ips) == 0 {
		return nil, domain.NewTargetBlockedError(fmt.Sprintf("target host %q resolved to zero IP addresses", host))
	}

	for _, ip := range ips {
		if g.IsBlockedIP(ip) {
			return nil, domain.NewTargetBlockedError(fmt.Sprintf("target host %q resolves to blocked IP address %s", host, ip.String()))
		}
	}

	return u, nil
}
