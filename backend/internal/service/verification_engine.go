package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
)

// DNSTXTResolver provides an interface for performing DNS TXT queries.
type DNSTXTResolver interface {
	LookupTXT(ctx context.Context, name string) ([]string, error)
}

// DefaultDNSTXTResolver uses Go's standard DNS resolver.
type DefaultDNSTXTResolver struct{}

func (r *DefaultDNSTXTResolver) LookupTXT(ctx context.Context, name string) ([]string, error) {
	return net.DefaultResolver.LookupTXT(ctx, name)
}

// HTTPFileFetcher provides an interface for fetching remote verification files.
type HTTPFileFetcher interface {
	FetchWellKnownFile(ctx context.Context, targetURL string) (string, error)
}

// SSRFSafeHTTPFetcher fetches well-known verification files using an SSRF-hardened HTTP client.
type SSRFSafeHTTPFetcher struct {
	client *http.Client
}

// NewSSRFSafeHTTPFetcher creates an SSRF-safe HTTP client with timeouts, body limits, and connection guards.
func NewSSRFSafeHTTPFetcher(guard *netguard.SSRFGuard) *SSRFSafeHTTPFetcher {
	dialer := &net.Dialer{
		Timeout:   4 * time.Second,
		KeepAlive: 10 * time.Second,
	}

	transport := &http.Transport{
		Proxy:                 nil, // Disable proxies for verification probe
		ResponseHeaderTimeout: 4 * time.Second,
		TLSHandshakeTimeout:   4 * time.Second,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, _, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, err
			}
			if ip := net.ParseIP(host); ip != nil {
				if guard.IsBlockedIP(ip) {
					return nil, fmt.Errorf("connection to blocked IP address %s refused", ip.String())
				}
			}
			return dialer.DialContext(ctx, network, addr)
		},
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   6 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return fmt.Errorf("stopped after 3 redirects")
			}
			// Check redirect target against SSRF
			if _, err := guard.ValidateTargetURL(req.Context(), req.URL.String()); err != nil {
				return fmt.Errorf("redirect target blocked: %w", err)
			}
			return nil
		},
	}

	return &SSRFSafeHTTPFetcher{client: client}
}

func (f *SSRFSafeHTTPFetcher) FetchWellKnownFile(ctx context.Context, targetURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "STRIM-Labs-Verification/1.0 (+https://strim-labs.vercel.app)")

	resp, err := f.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP verification endpoint returned status %d", resp.StatusCode)
	}

	// Read up to 2KB to prevent memory exhaustion
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2048))
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(body)), nil
}

// VerificationEngine manages verification token creation and domain challenge checks.
type VerificationEngine struct {
	dnsResolver DNSTXTResolver
	fileFetcher HTTPFileFetcher
}

// NewVerificationEngine instantiates the verification engine.
func NewVerificationEngine(dnsResolver DNSTXTResolver, fileFetcher HTTPFileFetcher) *VerificationEngine {
	if dnsResolver == nil {
		dnsResolver = &DefaultDNSTXTResolver{}
	}
	return &VerificationEngine{
		dnsResolver: dnsResolver,
		fileFetcher: fileFetcher,
	}
}

// GenerateToken produces a cryptographically secure 32-hex character verification string.
func (e *VerificationEngine) GenerateToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// BuildInstructions formats user instructions for both DNS TXT and HTTP file checks.
func (e *VerificationEngine) BuildInstructions(baseURL, token string) domain.VerificationInstructions {
	u, err := url.Parse(baseURL)
	host := ""
	scheme := "https"
	if err == nil {
		host = u.Hostname()
		if u.Scheme != "" {
			scheme = u.Scheme
		}
	}

	dnsHost := fmt.Sprintf("_strim.%s", host)
	if host == "" {
		dnsHost = "_strim"
	}

	fileURL := fmt.Sprintf("%s://%s/.well-known/strim-verify.txt", scheme, host)
	if host == "" {
		fileURL = "/.well-known/strim-verify.txt"
	}

	fullTokenVal := fmt.Sprintf("strim-verify=%s", token)

	return domain.VerificationInstructions{
		DNS: domain.DNSInstructions{
			Type:  "TXT",
			Host:  dnsHost,
			Value: fullTokenVal,
		},
		File: domain.FileInstructions{
			URL:     fileURL,
			Content: token,
		},
	}
}

// VerifyDNS checks DNS TXT records for the token challenge.
func (e *VerificationEngine) VerifyDNS(ctx context.Context, baseURL, expectedToken string) (bool, string) {
	u, err := url.Parse(baseURL)
	if err != nil {
		return false, "Invalid project base URL"
	}
	host := u.Hostname()
	if host == "" {
		return false, "Target host is missing"
	}

	cleanToken := strings.TrimPrefix(expectedToken, "strim-verify=")
	expectedFull := fmt.Sprintf("strim-verify=%s", cleanToken)

	// Targets to check: _strim.<host> first, then <host>
	candidates := []string{
		fmt.Sprintf("_strim.%s", host),
		host,
	}

	var checkedRecords []string
	for _, target := range candidates {
		records, err := e.dnsResolver.LookupTXT(ctx, target)
		if err == nil {
			for _, rec := range records {
				trimmed := strings.TrimSpace(rec)
				checkedRecords = append(checkedRecords, trimmed)
				if trimmed == expectedFull || trimmed == cleanToken {
					return true, ""
				}
			}
		}
	}

	if len(checkedRecords) == 0 {
		return false, fmt.Sprintf("No TXT records found at _strim.%s or %s", host, host)
	}
	return false, fmt.Sprintf("TXT record found but value did not match expected %q", expectedFull)
}

// VerifyHTTP requests the well-known file and checks its token content.
func (e *VerificationEngine) VerifyHTTP(ctx context.Context, baseURL, expectedToken string) (bool, string) {
	if e.fileFetcher == nil {
		return false, "HTTP file verification fetcher is not configured"
	}

	u, err := url.Parse(baseURL)
	if err != nil {
		return false, "Invalid project base URL"
	}

	targetURL := fmt.Sprintf("%s://%s/.well-known/strim-verify.txt", u.Scheme, u.Host)
	content, err := e.fileFetcher.FetchWellKnownFile(ctx, targetURL)
	if err != nil {
		return false, fmt.Sprintf("Failed to fetch %s: %v", targetURL, err)
	}

	cleanToken := strings.TrimPrefix(expectedToken, "strim-verify=")
	cleanContent := strings.TrimSpace(strings.TrimPrefix(content, "strim-verify="))

	if cleanContent == cleanToken {
		return true, ""
	}

	return false, fmt.Sprintf("File content mismatch: received %q, expected %q", cleanContent, cleanToken)
}
