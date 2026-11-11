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

const sampleOpenAPISpec = `{
  "openapi": "3.0.0",
  "info": { "title": "Store Service", "version": "1.0.0" },
  "paths": {
    "/products": {
      "get": { "tags": ["catalog"], "responses": { "200": { "description": "OK" } } },
      "post": { "tags": ["admin"], "responses": { "201": { "description": "Created" } } }
    },
    "/products/{id}": {
      "get": { "tags": ["catalog"], "responses": { "200": { "description": "OK" } } }
    }
  }
}`

func setupDiscoveryServiceTest(t *testing.T) (service.DiscoveryService, repository.EndpointRepository, repository.ProjectRepository) {
	projRepo := repository.NewInMemoryProjectRepository()
	endpointRepo := repository.NewInMemoryEndpointRepository()
	parser := discovery.NewOpenAPIParser(nil)
	svc := service.NewDiscoveryService(endpointRepo, projRepo, parser)
	return svc, endpointRepo, projRepo
}

func TestDiscoveryService_ImportOpenAPI(t *testing.T) {
	svc, endpointRepo, _ := setupDiscoveryServiceTest(t)
	ctx := context.Background()
	projectID := "proj-disc-1"

	run, err := svc.ImportOpenAPI(ctx, projectID, []byte(sampleOpenAPISpec), "")
	require.NoError(t, err)
	assert.Equal(t, domain.RunStatusCompleted, run.Status)
	assert.Equal(t, 3, run.Found)
	assert.Equal(t, 3, run.Created)
	assert.Equal(t, 0, run.Updated)

	// Re-importing same spec should update existing routes rather than duplicate
	run2, err := svc.ImportOpenAPI(ctx, projectID, []byte(sampleOpenAPISpec), "")
	require.NoError(t, err)
	assert.Equal(t, 3, run2.Found)
	assert.Equal(t, 0, run2.Created)
	assert.Equal(t, 3, run2.Updated)

	// Verify endpoints in repo
	eps, _, err := endpointRepo.List(ctx, projectID, domain.ListEndpointsQuery{})
	require.NoError(t, err)
	assert.Len(t, eps, 3)
}

func TestDiscoveryService_ImportManifest(t *testing.T) {
	svc, endpointRepo, _ := setupDiscoveryServiceTest(t)
	ctx := context.Background()
	projectID := "proj-disc-2"

	manifest := &domain.DiscoveryManifest{
		Version: 1,
		Source:  domain.SourceManifest,
		Service: "billing",
		Commit:  "abcdef1",
		Routes: []domain.DiscoveryManifestRoute{
			{Method: "GET", Path: "/invoices", Tags: []string{"billing"}},
			{Method: "POST", Path: "/invoices/pay", Tags: []string{"billing", "payments"}},
		},
	}

	run, err := svc.ImportManifest(ctx, projectID, manifest)
	require.NoError(t, err)
	assert.Equal(t, domain.RunStatusCompleted, run.Status)
	assert.Equal(t, 2, run.Found)
	assert.Equal(t, 2, run.Created)

	// Verify discovery run listing
	runs, err := svc.ListDiscoveryRuns(ctx, projectID, 10)
	require.NoError(t, err)
	assert.Len(t, runs, 1)
	assert.Equal(t, domain.SourceManifest, runs[0].Source)

	// Verify endpoints in repo
	eps, _, err := endpointRepo.List(ctx, projectID, domain.ListEndpointsQuery{})
	require.NoError(t, err)
	assert.Len(t, eps, 2)
}
