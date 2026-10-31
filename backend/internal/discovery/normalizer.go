package discovery

import (
	"regexp"
	"strings"
)

var (
	uuidRegex    = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	numericRegex = regexp.MustCompile(`^\d+$`)
	hexHashRegex = regexp.MustCompile(`^[0-9a-fA-F]{24,64}$`)
)

// NormalizePath converts raw runtime paths with concrete IDs into normalized templates.
// e.g. /v1/users/123 -> /v1/users/{id}
// e.g. /projects/0192f1b2-7c1e-7a3b-9d0a-3f5b6c7d8e9f/endpoints -> /projects/{id}/endpoints
func NormalizePath(rawPath string) string {
	segments := strings.Split(strings.Trim(rawPath, "/"), "/")
	normalized := make([]string, len(segments))

	for i, seg := range segments {
		if uuidRegex.MatchString(seg) || numericRegex.MatchString(seg) || hexHashRegex.MatchString(seg) {
			normalized[i] = "{id}"
		} else {
			normalized[i] = seg
		}
	}

	return "/" + strings.Join(normalized, "/")
}
