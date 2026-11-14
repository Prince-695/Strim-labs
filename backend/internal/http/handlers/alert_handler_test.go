package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAlertHandler_AlertRules_CRUD_And_Mute(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// 1. Create Channel first
	chReqBody, _ := json.Marshal(domain.CreateChannelRequest{
		Type: domain.ChannelTypeEmail,
		Name: "Oncall Team",
		Config: domain.JSONMap{
			"addresses": []interface{}{"oncall@acme.com"},
		},
	})
	chReq := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/notification-channels", tc.orgID, tc.projectID), bytes.NewReader(chReqBody))
	chReq.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	chReq.Header.Set("Content-Type", "application/json")
	chResp, err := tc.rig.app.Test(chReq)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, chResp.StatusCode)

	var chBody domain.Response
	_ = json.NewDecoder(chResp.Body).Decode(&chBody)
	chData := chBody.Data.(map[string]interface{})
	channelID := chData["id"].(string)

	// 2. Create Alert Rule (Member+)
	ruleReqBody, _ := json.Marshal(domain.CreateAlertRuleRequest{
		Name:        "High Error Rate",
		Description: "Triggers when 5xx errors > 5%",
		Scope: domain.AlertScope{
			Type: domain.AlertScopeProject,
		},
		Condition: domain.AlertCondition{
			Metric:    "error_rate",
			Operator:  ">",
			Threshold: 0.05,
			Window:    "5m",
			For:       "2m",
		},
		Severity:   domain.AlertSeverityCritical,
		ChannelIDs: []string{channelID},
	})

	reqCreate := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules", tc.orgID, tc.projectID), bytes.NewReader(ruleReqBody))
	reqCreate.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqCreate.Header.Set("Content-Type", "application/json")
	respCreate, err := tc.rig.app.Test(reqCreate)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respCreate.StatusCode)

	var createBody domain.Response
	_ = json.NewDecoder(respCreate.Body).Decode(&createBody)
	ruleData := createBody.Data.(map[string]interface{})
	ruleID := ruleData["id"].(string)
	assert.Equal(t, float64(1), ruleData["version"])

	// 3. Get Alert Rule (Viewer+)
	reqGet := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules/%s", tc.orgID, tc.projectID, ruleID), nil)
	reqGet.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	respGet, err := tc.rig.app.Test(reqGet)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respGet.StatusCode)

	// 4. Update Rule with optimistic version match (Version 1 -> Success)
	newName := "Elevated 5xx Error Rate"
	updateBody, _ := json.Marshal(domain.UpdateAlertRuleRequest{
		Version: 1,
		Name:    &newName,
	})
	reqUpdate := httptest.NewRequest("PUT", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules/%s", tc.orgID, tc.projectID, ruleID), bytes.NewReader(updateBody))
	reqUpdate.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqUpdate.Header.Set("Content-Type", "application/json")
	respUpdate, err := tc.rig.app.Test(reqUpdate)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respUpdate.StatusCode)

	var upData domain.Response
	_ = json.NewDecoder(respUpdate.Body).Decode(&upData)
	upMap := upData.Data.(map[string]interface{})
	assert.Equal(t, float64(2), upMap["version"])
	assert.Equal(t, "Elevated 5xx Error Rate", upMap["name"])

	// 5. Stale version update (sending old version 1 -> 409 Conflict)
	reqStale := httptest.NewRequest("PUT", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules/%s", tc.orgID, tc.projectID, ruleID), bytes.NewReader(updateBody))
	reqStale.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqStale.Header.Set("Content-Type", "application/json")
	respStale, err := tc.rig.app.Test(reqStale)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusConflict, respStale.StatusCode)

	// 6. Mute Rule
	muteBody, _ := json.Marshal(domain.MuteAlertRuleRequest{Minutes: 60})
	reqMute := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules/%s/mute", tc.orgID, tc.projectID, ruleID), bytes.NewReader(muteBody))
	reqMute.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqMute.Header.Set("Content-Type", "application/json")
	respMute, err := tc.rig.app.Test(reqMute)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respMute.StatusCode)

	// 7. Delete Rule
	reqDel := httptest.NewRequest("DELETE", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules/%s", tc.orgID, tc.projectID, ruleID), nil)
	reqDel.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	respDel, err := tc.rig.app.Test(reqDel)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respDel.StatusCode)
}

func TestIncidentHandler_TriageAndComments(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()
	now := time.Now().UTC()

	// Seed incident
	inc := &domain.Incident{
		ID:             "inc-http-1",
		OrgID:          tc.orgID,
		ProjectID:      tc.projectID,
		RuleID:         "rule-err",
		Status:         domain.IncidentStatusOpen,
		Severity:       domain.AlertSeverityCritical,
		Title:          "Critical Error Spike",
		Summary:        "5xx rate reached 15%",
		CurrentValue:   15.0,
		ThresholdValue: 5.0,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, tc.rig.incidentRepo.Create(ctx, inc))
	require.NoError(t, tc.rig.incidentRepo.AddEvent(ctx, &domain.IncidentEvent{
		ID:         "ev-open",
		IncidentID: "inc-http-1",
		Type:       domain.IncidentEventOpened,
		Actor:      "system",
		Detail:     "Error rate exceeded threshold",
		At:         now,
	}))

	// 1. List Incidents (Viewer+)
	reqList := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/incidents?status=open&severity=critical", tc.orgID, tc.projectID), nil)
	reqList.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	respList, err := tc.rig.app.Test(reqList)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respList.StatusCode)

	var listBody domain.Response
	_ = json.NewDecoder(respList.Body).Decode(&listBody)
	listData := listBody.Data.(map[string]interface{})
	incidents := listData["incidents"].([]interface{})
	require.Len(t, incidents, 1)

	// 2. Acknowledge Incident (Member+)
	reqAck := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/incidents/%s/acknowledge", tc.orgID, tc.projectID, "inc-http-1"), nil)
	reqAck.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	respAck, err := tc.rig.app.Test(reqAck)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respAck.StatusCode)

	var ackBody domain.Response
	_ = json.NewDecoder(respAck.Body).Decode(&ackBody)
	ackData := ackBody.Data.(map[string]interface{})
	assert.Equal(t, "acknowledged", ackData["status"])

	// 3. Add Comment (Member+)
	commentBody, _ := json.Marshal(domain.AddIncidentCommentRequest{Body: "Investigating pod restarts in cluster"})
	reqComment := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/incidents/%s/comments", tc.orgID, tc.projectID, "inc-http-1"), bytes.NewReader(commentBody))
	reqComment.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	reqComment.Header.Set("Content-Type", "application/json")
	respComment, err := tc.rig.app.Test(reqComment)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respComment.StatusCode)

	// 4. Resolve Incident (Member+)
	reqResolve := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/incidents/%s/resolve", tc.orgID, tc.projectID, "inc-http-1"), nil)
	reqResolve.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	respResolve, err := tc.rig.app.Test(reqResolve)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respResolve.StatusCode)

	// 5. Get Incident Detail & Verify Timeline
	reqDetail := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/incidents/%s", tc.orgID, tc.projectID, "inc-http-1"), nil)
	reqDetail.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	respDetail, err := tc.rig.app.Test(reqDetail)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respDetail.StatusCode)

	var detailBody domain.Response
	_ = json.NewDecoder(respDetail.Body).Decode(&detailBody)
	detailData := detailBody.Data.(map[string]interface{})
	timeline := detailData["timeline"].([]interface{})
	require.Len(t, timeline, 4) // opened, acknowledged, comment, resolved
}

func TestChannelHandler_Channels_And_TestDispatch(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// 1. Create Slack Channel (Admin+)
	slackBody, _ := json.Marshal(domain.CreateChannelRequest{
		Type: domain.ChannelTypeSlack,
		Name: "#prod-alerts",
		Config: domain.JSONMap{
			"webhook_url": "https://api.acme.com/slack/webhook",
		},
	})
	reqSlack := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/notification-channels", tc.orgID, tc.projectID), bytes.NewReader(slackBody))
	reqSlack.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	reqSlack.Header.Set("Content-Type", "application/json")
	respSlack, err := tc.rig.app.Test(reqSlack)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respSlack.StatusCode)

	var slackRespBody domain.Response
	_ = json.NewDecoder(respSlack.Body).Decode(&slackRespBody)
	slackData := slackRespBody.Data.(map[string]interface{})
	channelID := slackData["id"].(string)

	// Secret must be masked on response!
	cfg := slackData["config"].(map[string]interface{})
	assert.Equal(t, "***", cfg["webhook_url"])

	// 2. Test send
	reqTest := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/notification-channels/%s/test", tc.orgID, tc.projectID, channelID), nil)
	reqTest.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	respTest, err := tc.rig.app.Test(reqTest)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respTest.StatusCode)

	// 3. Update Channel
	newName := "#critical-eng"
	upBody, _ := json.Marshal(domain.UpdateChannelRequest{Name: &newName})
	reqUp := httptest.NewRequest("PUT", fmt.Sprintf("/v1/organizations/%s/projects/%s/notification-channels/%s", tc.orgID, tc.projectID, channelID), bytes.NewReader(upBody))
	reqUp.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	reqUp.Header.Set("Content-Type", "application/json")
	respUp, err := tc.rig.app.Test(reqUp)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respUp.StatusCode)

	// 4. Delete Channel
	reqDel := httptest.NewRequest("DELETE", fmt.Sprintf("/v1/organizations/%s/projects/%s/notification-channels/%s", tc.orgID, tc.projectID, channelID), nil)
	reqDel.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	respDel, err := tc.rig.app.Test(reqDel)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respDel.StatusCode)
}

func TestAlerting_RBAC_Matrix(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()

	// Seed alert rule, incident, and channel
	ch := &domain.NotificationChannel{
		ID:        "ch-rbac",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		Type:      domain.ChannelTypeEmail,
		Name:      "Email Team",
		Config:    domain.JSONMap{"addresses": []interface{}{"devops@acme.com"}},
		Enabled:   true,
	}
	require.NoError(t, tc.rig.channelRepo.Create(ctx, ch))

	rule := &domain.AlertRule{
		ID:        "rule-rbac",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		Name:      "RBAC Rule",
		Enabled:   true,
		Version:   1,
		Severity:  domain.AlertSeverityInfo,
		State:     domain.AlertStateOK,
	}
	require.NoError(t, tc.rig.alertRepo.Create(ctx, rule))

	inc := &domain.Incident{
		ID:        "inc-rbac",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		RuleID:    "rule-rbac",
		Status:    domain.IncidentStatusOpen,
		Severity:  domain.AlertSeverityInfo,
		Title:     "RBAC Incident",
	}
	require.NoError(t, tc.rig.incidentRepo.Create(ctx, inc))

	// 1. Alert Rules RBAC
	// POST /alert-rules: Owner, Admin, Member -> 201; Viewer -> 403
	ruleCreateBody, _ := json.Marshal(domain.CreateAlertRuleRequest{
		Name:      "New Rule",
		Scope:     domain.AlertScope{Type: domain.AlertScopeProject},
		Condition: domain.AlertCondition{Metric: "rps", Operator: ">", Threshold: 100},
		Severity:  domain.AlertSeverityInfo,
	})
	for role, expectedCode := range map[string]int{
		"owner":  fiber.StatusCreated,
		"admin":  fiber.StatusCreated,
		"member": fiber.StatusCreated,
		"viewer": fiber.StatusForbidden,
	} {
		req := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules", tc.orgID, tc.projectID), bytes.NewReader(ruleCreateBody))
		req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		req.Header.Set("Content-Type", "application/json")
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, expectedCode, resp.StatusCode, "POST alert-rules for role %s", role)
	}

	// GET /alert-rules: Viewer+ -> 200
	for _, role := range []string{"owner", "admin", "member", "viewer"} {
		req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules", tc.orgID, tc.projectID), nil)
		req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode, "GET alert-rules for role %s", role)
	}

	// 2. Incidents RBAC
	// GET /incidents: Viewer+ -> 200
	for _, role := range []string{"owner", "admin", "member", "viewer"} {
		req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/incidents", tc.orgID, tc.projectID), nil)
		req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode, "GET incidents for role %s", role)
	}

	// POST /incidents/:id/comments: Member+ -> 201; Viewer -> 403
	commentJSON, _ := json.Marshal(domain.AddIncidentCommentRequest{Body: "RBAC check comment"})
	for role, expectedCode := range map[string]int{
		"owner":  fiber.StatusCreated,
		"admin":  fiber.StatusCreated,
		"member": fiber.StatusCreated,
		"viewer": fiber.StatusForbidden,
	} {
		req := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/incidents/%s/comments", tc.orgID, tc.projectID, "inc-rbac"), bytes.NewReader(commentJSON))
		req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		req.Header.Set("Content-Type", "application/json")
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, expectedCode, resp.StatusCode, "POST incident comment for role %s", role)
	}

	// 3. Channels RBAC
	// POST /notification-channels: Admin+ -> 201; Member -> 403, Viewer -> 403
	chJSON, _ := json.Marshal(domain.CreateChannelRequest{
		Type:   domain.ChannelTypeEmail,
		Name:   "Admin Only Channel",
		Config: domain.JSONMap{"addresses": []interface{}{"admin@acme.com"}},
	})
	for role, expectedCode := range map[string]int{
		"owner":  fiber.StatusCreated,
		"admin":  fiber.StatusCreated,
		"member": fiber.StatusForbidden,
		"viewer": fiber.StatusForbidden,
	} {
		req := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/notification-channels", tc.orgID, tc.projectID), bytes.NewReader(chJSON))
		req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		req.Header.Set("Content-Type", "application/json")
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, expectedCode, resp.StatusCode, "POST channel for role %s", role)
	}

	// 4. Outsider Isolation: Returns 404 Not Found on all endpoints
	outsiderEndpoints := []struct {
		method string
		url    string
		body   []byte
	}{
		{"GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules", tc.orgID, tc.projectID), nil},
		{"POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/alert-rules", tc.orgID, tc.projectID), ruleCreateBody},
		{"GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/incidents", tc.orgID, tc.projectID), nil},
		{"POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/incidents/%s/comments", tc.orgID, tc.projectID, "inc-rbac"), commentJSON},
		{"GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/notification-channels", tc.orgID, tc.projectID), nil},
		{"POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/notification-channels", tc.orgID, tc.projectID), chJSON},
	}

	for _, ep := range outsiderEndpoints {
		var bodyReader io.Reader
		if ep.body != nil {
			bodyReader = bytes.NewReader(ep.body)
		}
		req := httptest.NewRequest(ep.method, ep.url, bodyReader)
		req.Header.Set("Authorization", "Bearer "+tc.outsiderTok)
		if ep.body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode, "outsider isolation for %s %s", ep.method, ep.url)
	}
}
