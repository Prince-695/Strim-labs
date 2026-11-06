package discovery

import (
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// ParseManifest processes and normalizes routes declared in a route discovery manifest.
func ParseManifest(manifest *domain.DiscoveryManifest) ([]DiscoveredRoute, error) {
	if manifest == nil {
		return nil, domain.NewInvalidManifestError("Manifest payload cannot be empty")
	}

	if manifest.Version != 1 {
		return nil, domain.NewInvalidManifestError("Unsupported manifest version; only version 1 is supported")
	}

	service := strings.TrimSpace(manifest.Service)
	if service == "" {
		return nil, domain.NewInvalidManifestError("Service name is required")
	}

	if len(manifest.Routes) == 0 {
		return nil, domain.NewInvalidManifestError("Manifest must declare at least one route")
	}

	routes := make([]DiscoveredRoute, 0, len(manifest.Routes))
	for _, r := range manifest.Routes {
		normMethod := NormalizeMethod(r.Method)
		if normMethod == "" {
			return nil, domain.NewInvalidManifestError("Route method cannot be empty")
		}

		rawPath := strings.TrimSpace(r.Path)
		if rawPath == "" {
			return nil, domain.NewInvalidManifestError("Route path cannot be empty")
		}
		normPath := NormalizePath(rawPath)

		// Clean and deduplicate tags
		cleanTags := make([]string, 0, len(r.Tags))
		tagSet := make(map[string]struct{})
		for _, t := range r.Tags {
			trimmed := strings.ToLower(strings.TrimSpace(t))
			if trimmed != "" {
				if _, seen := tagSet[trimmed]; !seen {
					tagSet[trimmed] = struct{}{}
					cleanTags = append(cleanTags, trimmed)
				}
			}
		}

		routes = append(routes, DiscoveredRoute{
			Method:       normMethod,
			PathTemplate: normPath,
			Service:      service,
			Tags:         cleanTags,
		})
	}

	return routes, nil
}
