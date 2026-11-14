package handlers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDashboardHandler_CRUD_Lifecycle(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// 1. Initial List: triggers auto-seeding of default "API Overview" dashboard
	reqListInit := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), nil)
	reqListInit.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	respListInit, err := tc.rig.app.Test(reqListInit)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respListInit.StatusCode)

	var listInitResp domain.Response
	_ = json.NewDecoder(respListInit.Body).Decode(&listInitResp)
	initItems := listInitResp.Data.([]interface{})
	require.Len(t, initItems, 1)
	defaultDashItem := initItems[0].(map[string]interface{})
	assert.Equal(t, "API Overview", defaultDashItem["name"])
	assert.True(t, defaultDashItem["is_default"].(bool))
	defaultDashID := defaultDashItem["id"].(string)

	// 2. Create custom dashboard (Member+)
	createPayload := domain.CreateDashboardRequest{
		Name:      "Service Health & SLOs",
		TimeRange: "24h",
		Widgets: []domain.Widget{
			{
				Type:  domain.WidgetTypeTimeseries,
				Title: "Latency P99 SLO",
				Layout: domain.WidgetLayout{
					X: 0,
					Y: 0,
					W: 6,
					H: 4,
				},
				Query: domain.WidgetQuery{
					Metric:  "p99",
					GroupBy: "endpoint",
				},
				Options: domain.WidgetOptions{
					Unit: "ms",
				},
			},
			{
				Type:  domain.WidgetTypeStat,
				Title: "Total RPS",
				Layout: domain.WidgetLayout{
					X: 6,
					Y: 0,
					W: 6,
					H: 4,
				},
				Query: domain.WidgetQuery{
					Metric:  "rps",
					GroupBy: "none",
				},
			},
		},
	}
	createBytes, _ := json.Marshal(createPayload)

	reqCreate := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), bytes.NewReader(createBytes))
	reqCreate.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqCreate.Header.Set("Content-Type", "application/json")
	respCreate, err := tc.rig.app.Test(reqCreate)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respCreate.StatusCode)

	var createResp domain.Response
	_ = json.NewDecoder(respCreate.Body).Decode(&createResp)
	dashData := createResp.Data.(map[string]interface{})
	customDashID := dashData["id"].(string)
	assert.Equal(t, "Service Health & SLOs", dashData["name"])
	assert.False(t, dashData["is_default"].(bool))
	assert.Equal(t, float64(1), dashData["version"])
	widgets := dashData["widgets"].([]interface{})
	assert.Len(t, widgets, 2)

	// 3. Get custom dashboard
	reqGet := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s", tc.orgID, tc.projectID, customDashID), nil)
	reqGet.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	respGet, err := tc.rig.app.Test(reqGet)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respGet.StatusCode)

	var getResp domain.Response
	_ = json.NewDecoder(respGet.Body).Decode(&getResp)
	getData := getResp.Data.(map[string]interface{})
	assert.Equal(t, customDashID, getData["id"])
	assert.Equal(t, "24h", getData["time_range"])

	// 4. Update with Version Conflict (Stale Version = 99)
	updName := "Updated SLOs"
	updateConflictPayload := domain.UpdateDashboardRequest{
		Version: 99,
		Name:    &updName,
	}
	conflictBytes, _ := json.Marshal(updateConflictPayload)
	reqConflict := httptest.NewRequest("PUT", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s", tc.orgID, tc.projectID, customDashID), bytes.NewReader(conflictBytes))
	reqConflict.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqConflict.Header.Set("Content-Type", "application/json")
	respConflict, err := tc.rig.app.Test(reqConflict)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusConflict, respConflict.StatusCode)

	var conflictResp domain.Response
	_ = json.NewDecoder(respConflict.Body).Decode(&conflictResp)
	assert.Equal(t, domain.ErrCodeVersionConflict, conflictResp.ErrorCode)

	// 5. Successful Update with Expected Version = 1
	updatePayload := domain.UpdateDashboardRequest{
		Version: 1,
		Name:    &updName,
	}
	updateBytes, _ := json.Marshal(updatePayload)
	reqUpdate := httptest.NewRequest("PUT", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s", tc.orgID, tc.projectID, customDashID), bytes.NewReader(updateBytes))
	reqUpdate.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqUpdate.Header.Set("Content-Type", "application/json")
	respUpdate, err := tc.rig.app.Test(reqUpdate)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respUpdate.StatusCode)

	var updateResp domain.Response
	_ = json.NewDecoder(respUpdate.Body).Decode(&updateResp)
	updatedData := updateResp.Data.(map[string]interface{})
	assert.Equal(t, "Updated SLOs", updatedData["name"])
	assert.Equal(t, float64(2), updatedData["version"])

	// 6. Delete default dashboard must fail (403 Forbidden)
	reqDelDefault := httptest.NewRequest("DELETE", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s", tc.orgID, tc.projectID, defaultDashID), nil)
	reqDelDefault.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	respDelDefault, err := tc.rig.app.Test(reqDelDefault)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusForbidden, respDelDefault.StatusCode)

	var delDefResp domain.Response
	_ = json.NewDecoder(respDelDefault.Body).Decode(&delDefResp)
	assert.Equal(t, domain.ErrCodeDefaultDashboardUndeletable, delDefResp.ErrorCode)

	// 7. Delete custom dashboard succeeds (200 OK)
	reqDelCustom := httptest.NewRequest("DELETE", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s", tc.orgID, tc.projectID, customDashID), nil)
	reqDelCustom.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	respDelCustom, err := tc.rig.app.Test(reqDelCustom)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respDelCustom.StatusCode)

	// 8. Confirm custom dashboard deleted (404 Not Found)
	reqGetDeleted := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s", tc.orgID, tc.projectID, customDashID), nil)
	reqGetDeleted.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	respGetDeleted, err := tc.rig.app.Test(reqGetDeleted)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, respGetDeleted.StatusCode)
}

func TestDashboardHandler_Clone(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// Seed default dashboard by listing
	reqList := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), nil)
	reqList.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	respList, err := tc.rig.app.Test(reqList)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respList.StatusCode)

	var listResp domain.Response
	_ = json.NewDecoder(respList.Body).Decode(&listResp)
	items := listResp.Data.([]interface{})
	require.NotEmpty(t, items)
	defaultDashID := items[0].(map[string]interface{})["id"].(string)

	// 1. Clone without name (defaults to "API Overview (copy)")
	reqClone := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s/clone", tc.orgID, tc.projectID, defaultDashID), bytes.NewReader([]byte("{}")))
	reqClone.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqClone.Header.Set("Content-Type", "application/json")
	respClone, err := tc.rig.app.Test(reqClone)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respClone.StatusCode)

	var cloneResp domain.Response
	_ = json.NewDecoder(respClone.Body).Decode(&cloneResp)
	clonedData := cloneResp.Data.(map[string]interface{})
	assert.NotEqual(t, defaultDashID, clonedData["id"])
	assert.Equal(t, "API Overview (copy)", clonedData["name"])
	assert.False(t, clonedData["is_default"].(bool))
	assert.Equal(t, float64(1), clonedData["version"])
	clonedWidgets := clonedData["widgets"].([]interface{})
	assert.Len(t, clonedWidgets, 4)

	// 2. Clone with custom name
	cloneCustomBody, _ := json.Marshal(domain.CloneDashboardRequest{
		Name: "Production Executive Dashboard",
	})
	reqCloneCustom := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s/clone", tc.orgID, tc.projectID, defaultDashID), bytes.NewReader(cloneCustomBody))
	reqCloneCustom.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqCloneCustom.Header.Set("Content-Type", "application/json")
	respCloneCustom, err := tc.rig.app.Test(reqCloneCustom)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respCloneCustom.StatusCode)

	var cloneCustomResp domain.Response
	_ = json.NewDecoder(respCloneCustom.Body).Decode(&cloneCustomResp)
	customClonedData := cloneCustomResp.Data.(map[string]interface{})
	assert.Equal(t, "Production Executive Dashboard", customClonedData["name"])
}

func TestDashboardHandler_Validation(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// 1. Malformed JSON
	reqBadJSON := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), bytes.NewReader([]byte("{invalid-json")))
	reqBadJSON.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqBadJSON.Header.Set("Content-Type", "application/json")
	respBadJSON, err := tc.rig.app.Test(reqBadJSON)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, respBadJSON.StatusCode)

	// 2. Disallowed raw SQL metric
	sqlInjectionPayload, _ := json.Marshal(domain.CreateDashboardRequest{
		Name: "SQL Attempt",
		Widgets: []domain.Widget{
			{
				Type:  domain.WidgetTypeTimeseries,
				Title: "Exploit",
				Query: domain.WidgetQuery{Metric: "DROP TABLE users;--"},
			},
		},
	})
	reqSQL := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), bytes.NewReader(sqlInjectionPayload))
	reqSQL.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqSQL.Header.Set("Content-Type", "application/json")
	respSQL, err := tc.rig.app.Test(reqSQL)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, respSQL.StatusCode)

	// 3. More than 30 widgets
	manyWidgets := make([]domain.Widget, 31)
	for i := 0; i < 31; i++ {
		manyWidgets[i] = domain.Widget{
			Type:  domain.WidgetTypeStat,
			Title: fmt.Sprintf("W%d", i),
			Query: domain.WidgetQuery{Metric: "rps"},
		}
	}
	tooManyPayload, _ := json.Marshal(domain.CreateDashboardRequest{
		Name:    "Overload",
		Widgets: manyWidgets,
	})
	reqTooMany := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), bytes.NewReader(tooManyPayload))
	reqTooMany.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqTooMany.Header.Set("Content-Type", "application/json")
	respTooMany, err := tc.rig.app.Test(reqTooMany)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, respTooMany.StatusCode)

	var tooManyResp domain.Response
	_ = json.NewDecoder(respTooMany.Body).Decode(&tooManyResp)
	assert.Equal(t, domain.ErrCodeTooManyWidgets, tooManyResp.ErrorCode)
}

func TestDashboardHandler_RBAC_Matrix(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// First create a dashboard to test GET, PUT, CLONE, DELETE
	validPayload, _ := json.Marshal(domain.CreateDashboardRequest{
		Name: "RBAC Test Dashboard",
		Widgets: []domain.Widget{
			{Type: domain.WidgetTypeTimeseries, Title: "Metric", Query: domain.WidgetQuery{Metric: "p95"}},
		},
	})
	reqSeed := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), bytes.NewReader(validPayload))
	reqSeed.Header.Set("Authorization", "Bearer "+tc.tokens["owner"])
	reqSeed.Header.Set("Content-Type", "application/json")
	respSeed, err := tc.rig.app.Test(reqSeed)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respSeed.StatusCode)

	var seedResp domain.Response
	_ = json.NewDecoder(respSeed.Body).Decode(&seedResp)
	dashID := seedResp.Data.(map[string]interface{})["id"].(string)

	cases := []struct {
		name           string
		method         string
		path           string
		body           []byte
		role           string
		token          string
		expectedStatus int
	}{
		// 1. POST /dashboards (Requires member+)
		{"Create_Owner", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), validPayload, "owner", tc.tokens["owner"], fiber.StatusCreated},
		{"Create_Admin", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), validPayload, "admin", tc.tokens["admin"], fiber.StatusCreated},
		{"Create_Member", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), validPayload, "member", tc.tokens["member"], fiber.StatusCreated},
		{"Create_Viewer", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), validPayload, "viewer", tc.tokens["viewer"], fiber.StatusForbidden},
		{"Create_Outsider", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), validPayload, "outsider", tc.outsiderTok, fiber.StatusNotFound},
		{"Create_Unauth", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), validPayload, "unauth", "", fiber.StatusUnauthorized},

		// 2. GET /dashboards (Requires viewer+)
		{"List_Owner", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), nil, "owner", tc.tokens["owner"], fiber.StatusOK},
		{"List_Viewer", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), nil, "viewer", tc.tokens["viewer"], fiber.StatusOK},
		{"List_Outsider", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), nil, "outsider", tc.outsiderTok, fiber.StatusNotFound},
		{"List_Unauth", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards", tc.orgID, tc.projectID), nil, "unauth", "", fiber.StatusUnauthorized},

		// 3. GET /dashboards/:id (Requires viewer+)
		{"Get_Viewer", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s", tc.orgID, tc.projectID, dashID), nil, "viewer", tc.tokens["viewer"], fiber.StatusOK},
		{"Get_Outsider", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s", tc.orgID, tc.projectID, dashID), nil, "outsider", tc.outsiderTok, fiber.StatusNotFound},
		{"Get_Unauth", "GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s", tc.orgID, tc.projectID, dashID), nil, "unauth", "", fiber.StatusUnauthorized},

		// 4. POST /dashboards/:id/clone (Requires member+)
		{"Clone_Member", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s/clone", tc.orgID, tc.projectID, dashID), []byte("{}"), "member", tc.tokens["member"], fiber.StatusCreated},
		{"Clone_Viewer", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s/clone", tc.orgID, tc.projectID, dashID), []byte("{}"), "viewer", tc.tokens["viewer"], fiber.StatusForbidden},
		{"Clone_Outsider", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s/clone", tc.orgID, tc.projectID, dashID), []byte("{}"), "outsider", tc.outsiderTok, fiber.StatusNotFound},
		{"Clone_Unauth", "POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/dashboards/%s/clone", tc.orgID, tc.projectID, dashID), []byte("{}"), "unauth", "", fiber.StatusUnauthorized},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var bodyReader *bytes.Reader
			if c.body != nil {
				bodyReader = bytes.NewReader(c.body)
			} else {
				bodyReader = bytes.NewReader([]byte{})
			}

			req := httptest.NewRequest(c.method, c.path, bodyReader)
			if c.token != "" {
				req.Header.Set("Authorization", "Bearer "+c.token)
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := tc.rig.app.Test(req)
			require.NoError(t, err)
			assert.Equal(t, c.expectedStatus, resp.StatusCode)
		})
	}
}
