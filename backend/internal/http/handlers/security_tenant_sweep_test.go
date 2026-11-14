package handlers_test

import (
	"bytes"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSecurity_ComprehensiveCrossTenantIsolationSweep(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// Sub-routes under an organization / project that must NEVER be accessible to an outsider tenant.
	// Every single route must return 404 Not Found (or 403 Forbidden) when requested with tc.outsiderTok.
	routes := []struct {
		name   string
		method string
		path   string
		body   []byte
	}{
		// 1. Organization & Members
		{"Org_Get", "GET", fmt.Sprintf("/v1/organizations/%s", tc.orgID), nil},
		{"Org_ListMembers", "GET", fmt.Sprintf("/v1/organizations/%s/members", tc.orgID), nil},
		{"Org_AddMember", "POST", fmt.Sprintf("/v1/organizations/%s/members", tc.orgID), []byte(`{"email":"spy@evil.corp","role":"member"}`)},

		// 2. Projects & Verification
		{"Project_List", "GET", fmt.Sprintf("/v1/organizations/%s/projects", tc.orgID), nil},
		{"Project_Get", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s", tc.orgID, tc.projectID), nil},
		{"Project_VerificationStatus", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/verification", tc.orgID, tc.projectID), nil},

		// 3. Registry & Discovery
		{"Endpoints_List", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/endpoints", tc.orgID, tc.projectID), nil},
		{"Discovery_Runs", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/discovery/runs", tc.orgID, tc.projectID), nil},

		// 4. Metrics & Observability
		{"Metrics_Overview", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/overview", tc.orgID, tc.projectID), nil},
		{"Metrics_Timeseries", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/timeseries", tc.orgID, tc.projectID), nil},
		{"Metrics_Endpoints", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/endpoints", tc.orgID, tc.projectID), nil},
		{"Metrics_StatusCodes", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/status-codes", tc.orgID, tc.projectID), nil},
		{"Metrics_Hosts", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/hosts", tc.orgID, tc.projectID), nil},

		// 5. Load Tests
		{"LoadTests_List", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests", tc.orgID, tc.projectID), nil},
		{"LoadTests_Create", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests", tc.orgID, tc.projectID), []byte(`{"name":"Attack Test"}`)},

		// 6. Diagnostics
		{"Diagnostics_SlowEndpoints", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/slow-endpoints", tc.orgID, tc.projectID), nil},
		{"Diagnostics_Regressions", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/regressions", tc.orgID, tc.projectID), nil},
		{"Diagnostics_Bottlenecks", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/bottlenecks", tc.orgID, tc.projectID), nil},

		// 7. Dashboards
		{"Dashboards_List", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), nil},
		{"Dashboards_Create", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), []byte(`{"name":"Spied Dashboard"}`)},

		// 8. Alerts, Incidents, Channels
		{"AlertRules_List", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules", tc.orgID, tc.projectID), nil},
		{"Incidents_List", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/incidents", tc.orgID, tc.projectID), nil},
		{"Channels_List", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/notification-channels", tc.orgID, tc.projectID), nil},

		// 9. API Keys, Webhooks, Audit Logs, Usage
		{"APIKeys_List", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/api-keys", tc.orgID, tc.projectID), nil},
		{"APIKeys_Create", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/api-keys", tc.orgID, tc.projectID), []byte(`{"name":"Exfiltrate Key","scopes":["ingest"]}`)},
		{"Webhooks_List", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/webhooks", tc.orgID, tc.projectID), nil},
		{"AuditLogs_List", "GET", fmt.Sprintf("/v1/organizations/%s/audit-logs", tc.orgID), nil},
		{"Usage_Get", "GET", fmt.Sprintf("/v1/organizations/%s/usage", tc.orgID), nil},
	}

	for _, route := range routes {
		t.Run(route.name, func(t *testing.T) {
			var bodyReader *bytes.Reader
			if route.body != nil {
				bodyReader = bytes.NewReader(route.body)
			} else {
				bodyReader = bytes.NewReader([]byte{})
			}

			req := httptest.NewRequest(route.method, route.path, bodyReader)
			req.Header.Set("Authorization", "Bearer "+tc.outsiderTok)
			req.Header.Set("Content-Type", "application/json")

			resp, err := tc.rig.app.Test(req)
			require.NoError(t, err)

			// Strict multi-tenant isolation: Foreign tenant token must NEVER succeed (200/201).
			// Must return 404 Not Found (or 403 Forbidden for non-member org actions).
			assert.Contains(t, []int{fiber.StatusNotFound, fiber.StatusForbidden}, resp.StatusCode,
				"Cross-tenant request to %s %s should return 404 or 403, got %d", route.method, route.path, resp.StatusCode)
		})
	}
}
