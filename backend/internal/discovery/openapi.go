package discovery

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/getkin/kin-openapi/openapi2"
	"github.com/getkin/kin-openapi/openapi2conv"
	"github.com/getkin/kin-openapi/openapi3"
)

// DiscoveredRoute represents a normalized route discovered from OpenAPI or Manifest sources.
type DiscoveredRoute struct {
	Method       string
	PathTemplate string
	Service      string
	Tags         []string
	OperationID  string
	Summary      string
}

// OpenAPIParser parses and extracts routes from OpenAPI 2.0 (Swagger) and OpenAPI 3.x specifications.
type OpenAPIParser struct {
	ssrfGuard *netguard.SSRFGuard
	client    *http.Client
}

// NewOpenAPIParser instantiates an OpenAPI parser with SSRF-safe remote spec fetching.
func NewOpenAPIParser(guard *netguard.SSRFGuard) *OpenAPIParser {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	return &OpenAPIParser{
		ssrfGuard: guard,
		client:    client,
	}
}

// ParseBytes parses raw JSON/YAML OpenAPI spec data into discovered routes.
func (p *OpenAPIParser) ParseBytes(data []byte) ([]DiscoveredRoute, string, error) {
	if len(data) == 0 {
		return nil, "", domain.NewInvalidOpenAPISpecError("Empty specification document")
	}

	// 1. Check if it's Swagger 2.0
	isSwagger2 := false
	var probe map[string]interface{}
	if err := json.Unmarshal(data, &probe); err == nil {
		if v, ok := probe["swagger"].(string); ok && strings.HasPrefix(v, "2.") {
			isSwagger2 = true
		}
	} else if strings.Contains(string(data), "swagger: \"2.") || strings.Contains(string(data), "swagger: '2.") || strings.Contains(string(data), "swagger: 2.") {
		isSwagger2 = true
	}

	var doc3 *openapi3.T
	var serviceName string

	if isSwagger2 {
		var doc2 openapi2.T
		if err := json.Unmarshal(data, &doc2); err != nil {
			return nil, "", domain.NewInvalidOpenAPISpecError(fmt.Sprintf("Failed to parse Swagger 2.0 document: %v", err))
		}
		if doc2.Info.Title != "" {
			serviceName = strings.ToLower(strings.ReplaceAll(doc2.Info.Title, " ", "-"))
		}
		converted, err := openapi2conv.ToV3(&doc2)
		if err != nil {
			return nil, "", domain.NewInvalidOpenAPISpecError(fmt.Sprintf("Failed to convert Swagger 2.0 to OpenAPI 3.0: %v", err))
		}
		doc3 = converted
	} else {
		loader := openapi3.NewLoader()
		loader.IsExternalRefsAllowed = false // Security: prevent external entity expansions
		parsed, err := loader.LoadFromData(data)
		if err != nil {
			return nil, "", domain.NewInvalidOpenAPISpecError(fmt.Sprintf("Failed to parse OpenAPI 3.x document: %v", err))
		}
		if parsed == nil || parsed.OpenAPI == "" || !strings.HasPrefix(parsed.OpenAPI, "3.") {
			return nil, "", domain.NewInvalidOpenAPISpecError("Document is missing valid OpenAPI 3.x version declaration")
		}
		doc3 = parsed
		if doc3.Info != nil && doc3.Info.Title != "" {
			serviceName = strings.ToLower(strings.ReplaceAll(doc3.Info.Title, " ", "-"))
		}
	}

	if doc3.Paths == nil || doc3.Paths.Len() == 0 {
		return []DiscoveredRoute{}, serviceName, nil
	}

	var routes []DiscoveredRoute
	methods := []string{
		http.MethodGet,
		http.MethodPost,
		http.MethodPut,
		http.MethodDelete,
		http.MethodPatch,
		http.MethodOptions,
		http.MethodHead,
	}

	for pathKey, pathItem := range doc3.Paths.Map() {
		normalizedPath := NormalizePath(pathKey)

		for _, method := range methods {
			op := pathItem.GetOperation(method)
			if op == nil {
				continue
			}

			tags := op.Tags
			if tags == nil {
				tags = []string{}
			}

			// Clean and deduplicate tags
			cleanTags := make([]string, 0, len(tags))
			tagSet := make(map[string]struct{})
			for _, t := range tags {
				trimmed := strings.ToLower(strings.TrimSpace(t))
				if trimmed != "" {
					if _, seen := tagSet[trimmed]; !seen {
						tagSet[trimmed] = struct{}{}
						cleanTags = append(cleanTags, trimmed)
					}
				}
			}

			routes = append(routes, DiscoveredRoute{
				Method:       method,
				PathTemplate: normalizedPath,
				Service:      serviceName,
				Tags:         cleanTags,
				OperationID:  op.OperationID,
				Summary:      op.Summary,
			})
		}
	}

	return routes, serviceName, nil
}

// FetchAndParseURL downloads an OpenAPI spec from an SSRF-safe URL and extracts its routes.
func (p *OpenAPIParser) FetchAndParseURL(ctx context.Context, targetURL string) ([]DiscoveredRoute, string, error) {
	if p.ssrfGuard != nil {
		if _, err := p.ssrfGuard.ValidateTargetURL(ctx, targetURL); err != nil {
			return nil, "", err
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, "", domain.NewBadRequestError("Invalid spec URL", err)
	}
	req.Header.Set("User-Agent", "STRIM-Labs-OpenAPI-Importer/1.0 (+https://strim-labs.vercel.app)")
	req.Header.Set("Accept", "application/json, application/yaml, text/yaml, */*")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, "", domain.NewBadRequestError(fmt.Sprintf("Failed to download OpenAPI spec: %v", err), err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", domain.NewBadRequestError(fmt.Sprintf("OpenAPI URL returned HTTP %d", resp.StatusCode), nil)
	}

	// 5 MB maximum file read limit per PRD
	maxBytes := int64(5 * 1024 * 1024)
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return nil, "", domain.NewBadRequestError("Failed to read spec response body", err)
	}
	if int64(len(data)) > maxBytes {
		return nil, "", domain.NewBadRequestError("OpenAPI specification exceeds the 5 MB limit", errors.New("file too large"))
	}

	return p.ParseBytes(data)
}
