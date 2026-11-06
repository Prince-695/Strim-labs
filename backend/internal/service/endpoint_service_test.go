package service_test

import (
	"context"
	"testing"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupEndpointServiceTest(t *testing.T) (service.EndpointService, repository.EndpointRepository, repository.ProjectRepository) {
	projRepo := repository.NewInMemoryProjectRepository()
	endpointRepo := repository.NewInMemoryEndpointRepository()
	svc := service.NewEndpointService(endpointRepo, projRepo)
	return svc, endpointRepo, projRepo
}

func TestEndpointService_List_And_Filter(t *testing.T) {
	svc, endpointRepo, _ := setupEndpointServiceTest(t)
	ctx := context.Background()
	projectID := "proj-test-1"

	// Seed routes
	r1 := discovery.DiscoveredRoute{Method: "GET", PathTemplate: "/users", Service: "users", Tags: []string{"public"}}
	r2 := discovery.DiscoveredRoute{Method: "POST", PathTemplate: "/users", Service: "users", Tags: []string{"admin"}}
	r3 := discovery.DiscoveredRoute{Method: "GET", PathTemplate: "/orders", Service: "orders", Tags: []string{"checkout"}}

	_, _, err := endpointRepo.UpsertRoute(ctx, projectID, r1, domain.SourceOpenAPI, nil)
	require.NoError(t, err)
	_, _, err = endpointRepo.UpsertRoute(ctx, projectID, r2, domain.SourceCI, nil)
	require.NoError(t, err)
	_, _, err = endpointRepo.UpsertRoute(ctx, projectID, r3, domain.SourceManifest, nil)
	require.NoError(t, err)

	t.Run("List all endpoints", func(t *testing.T) {
		res, meta, err := svc.ListEndpoints(ctx, projectID, domain.ListEndpointsQuery{})
		require.NoError(t, err)
		assert.Len(t, res, 3)
		assert.False(t, meta.HasMore)
	})

	t.Run("Filter by method", func(t *testing.T) {
		res, _, err := svc.ListEndpoints(ctx, projectID, domain.ListEndpointsQuery{Method: "GET"})
		require.NoError(t, err)
		assert.Len(t, res, 2)
	})

	t.Run("Filter by service", func(t *testing.T) {
		res, _, err := svc.ListEndpoints(ctx, projectID, domain.ListEndpointsQuery{Service: "orders"})
		require.NoError(t, err)
		assert.Len(t, res, 1)
		assert.Equal(t, "/orders", res[0].PathTemplate)
	})

	t.Run("Filter by tag", func(t *testing.T) {
		res, _, err := svc.ListEndpoints(ctx, projectID, domain.ListEndpointsQuery{Tag: "checkout"})
		require.NoError(t, err)
		assert.Len(t, res, 1)
	})

	t.Run("Filter by source", func(t *testing.T) {
		res, _, err := svc.ListEndpoints(ctx, projectID, domain.ListEndpointsQuery{Source: "openapi"})
		require.NoError(t, err)
		assert.Len(t, res, 1)
		assert.Equal(t, "/users", res[0].PathTemplate)
	})

	t.Run("Search q", func(t *testing.T) {
		res, _, err := svc.ListEndpoints(ctx, projectID, domain.ListEndpointsQuery{Q: "ord"})
		require.NoError(t, err)
		assert.Len(t, res, 1)
		assert.Equal(t, "/orders", res[0].PathTemplate)
	})
}

func TestEndpointService_Patch_Endpoint(t *testing.T) {
	svc, endpointRepo, _ := setupEndpointServiceTest(t)
	ctx := context.Background()
	projectID := "proj-test-1"

	r := discovery.DiscoveredRoute{Method: "GET", PathTemplate: "/items", Service: "catalog"}
	ep, _, err := endpointRepo.UpsertRoute(ctx, projectID, r, domain.SourceOpenAPI, nil)
	require.NoError(t, err)

	t.Run("Patch status to ignored", func(t *testing.T) {
		status := domain.EndpointStatusIgnored
		note := "Internal endpoint"
		patched, err := svc.PatchEndpoint(ctx, projectID, ep.ID, domain.PatchEndpointRequest{
			Status: &status,
			Note:   &note,
		})
		require.NoError(t, err)
		assert.Equal(t, domain.EndpointStatusIgnored, patched.Status)
		assert.Equal(t, "Internal endpoint", patched.Note)
	})

	t.Run("Reject setting stale status directly", func(t *testing.T) {
		status := domain.EndpointStatusStale
		_, err := svc.PatchEndpoint(ctx, projectID, ep.ID, domain.PatchEndpointRequest{
			Status: &status,
		})
		require.Error(t, err)
	})
}
