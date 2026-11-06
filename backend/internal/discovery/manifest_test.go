package discovery_test

import (
	"testing"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseManifest_Success(t *testing.T) {
	manifest := &domain.DiscoveryManifest{
		Version: 1,
		Source:  domain.SourceManifest,
		Service: "orders",
		Routes: []domain.DiscoveryManifestRoute{
			{Method: "get", Path: "/orders/{id}", Tags: []string{"orders", "PUBLIC"}},
			{Method: "POST", Path: "/orders/123/items", Tags: []string{"checkout"}},
		},
	}

	routes, err := discovery.ParseManifest(manifest)
	require.NoError(t, err)
	assert.Len(t, routes, 2)

	assert.Equal(t, "GET", routes[0].Method)
	assert.Equal(t, "/orders/{id}", routes[0].PathTemplate)
	assert.ElementsMatch(t, []string{"orders", "public"}, routes[0].Tags)

	assert.Equal(t, "POST", routes[1].Method)
	assert.Equal(t, "/orders/{id}/items", routes[1].PathTemplate) // Normalizer converted 123 -> {id}
}

func TestParseManifest_ValidationErrors(t *testing.T) {
	t.Run("Nil manifest", func(t *testing.T) {
		_, err := discovery.ParseManifest(nil)
		require.Error(t, err)
	})

	t.Run("Unsupported version", func(t *testing.T) {
		manifest := &domain.DiscoveryManifest{
			Version: 2,
			Service: "orders",
			Routes:  []domain.DiscoveryManifestRoute{{Method: "GET", Path: "/test"}},
		}
		_, err := discovery.ParseManifest(manifest)
		require.Error(t, err)
	})

	t.Run("Empty service", func(t *testing.T) {
		manifest := &domain.DiscoveryManifest{
			Version: 1,
			Service: "",
			Routes:  []domain.DiscoveryManifestRoute{{Method: "GET", Path: "/test"}},
		}
		_, err := discovery.ParseManifest(manifest)
		require.Error(t, err)
	})

	t.Run("Empty routes", func(t *testing.T) {
		manifest := &domain.DiscoveryManifest{
			Version: 1,
			Service: "orders",
			Routes:  []domain.DiscoveryManifestRoute{},
		}
		_, err := discovery.ParseManifest(manifest)
		require.Error(t, err)
	})
}
