package discovery

import (
	"net/url"
	"regexp"
	"strings"
)

var (
	// uuidRegex matches standard 36-character hyphenated UUIDs (v4, v7, etc.).
	uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

	// numericIDRegex matches positive integers representing database identifiers.
	numericIDRegex = regexp.MustCompile(`^[0-9]+$`)

	// hexHashRegex matches hashes like MD5 (32), SHA1 (40), SHA256 (64), or 32+ char hex digests.
	hexHashRegex = regexp.MustCompile(`^[0-9a-fA-F]{32,64}$`)

	// prefixedIDRegex matches Stripe/modern style prefixed IDs like usr_123, org_abc, cus_xyz.
	prefixedIDRegex = regexp.MustCompile(`^[a-z]{2,5}_[0-9a-zA-Z]{8,}$`)
)

// NormalizeMethod standardizes HTTP method strings to uppercase.
func NormalizeMethod(method string) string {
	return strings.ToUpper(strings.TrimSpace(method))
}

// NormalizePath converts raw runtime or parameterized URL paths into standardized path templates.
// Example: /users/123/orders/018f3a5b-7c91-7b00-8000-000000000001 -> /users/{id}/orders/{id}
func NormalizePath(rawPath string) string {
	cleaned := strings.TrimSpace(rawPath)
	if cleaned == "" {
		return "/"
	}

	// 1. If full URL provided, parse and take path
	if strings.HasPrefix(cleaned, "http://") || strings.HasPrefix(cleaned, "https://") {
		if u, err := url.Parse(cleaned); err == nil {
			cleaned = u.Path
		}
	}

	// 2. Strip query strings and fragment
	if idx := strings.IndexAny(cleaned, "?#"); idx != -1 {
		cleaned = cleaned[:idx]
	}

	// 3. Ensure leading slash
	if !strings.HasPrefix(cleaned, "/") {
		cleaned = "/" + cleaned
	}

	// 4. Strip trailing slash unless root "/"
	if len(cleaned) > 1 && strings.HasSuffix(cleaned, "/") {
		cleaned = strings.TrimRight(cleaned, "/")
	}

	// Fast path for root
	if cleaned == "/" {
		return "/"
	}

	segments := strings.Split(cleaned, "/")
	normalizedSegments := make([]string, 0, len(segments))

	for _, seg := range segments {
		if seg == "" {
			continue
		}

		// Check if segment is already a parameter {param}
		if strings.HasPrefix(seg, "{") && strings.HasSuffix(seg, "}") {
			normalizedSegments = append(normalizedSegments, seg)
			continue
		}

		// Convert Fiber/Express colon parameters :param -> {param}
		if strings.HasPrefix(seg, ":") && len(seg) > 1 {
			normalizedSegments = append(normalizedSegments, "{"+seg[1:]+"}")
			continue
		}

		// Check for UUID
		if uuidRegex.MatchString(seg) {
			normalizedSegments = append(normalizedSegments, "{id}")
			continue
		}

		// Check for Numeric ID
		if numericIDRegex.MatchString(seg) {
			normalizedSegments = append(normalizedSegments, "{id}")
			continue
		}

		// Check for Hash (MD5, SHA1, SHA256)
		if hexHashRegex.MatchString(seg) {
			normalizedSegments = append(normalizedSegments, "{hash}")
			continue
		}

		// Check for Prefixed ID (usr_..., org_...)
		if prefixedIDRegex.MatchString(seg) {
			normalizedSegments = append(normalizedSegments, "{id}")
			continue
		}

		// Static route token
		normalizedSegments = append(normalizedSegments, seg)
	}

	return "/" + strings.Join(normalizedSegments, "/")
}
