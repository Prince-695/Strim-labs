package discovery_test

import (
	"testing"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const openAPI3Spec = `{
  "openapi": "3.0.0",
  "info": {
    "title": "Acme Orders API",
    "version": "1.0.0"
  },
  "paths": {
    "/orders": {
      "get": {
        "operationId": "listOrders",
        "tags": ["orders"],
        "summary": "List all orders",
        "responses": { "200": { "description": "OK" } }
      },
      "post": {
        "operationId": "createOrder",
        "tags": ["orders", "checkout"],
        "summary": "Create order",
        "responses": { "201": { "description": "Created" } }
      }
    },
    "/orders/{id}": {
      "get": {
        "operationId": "getOrder",
        "tags": ["orders"],
        "responses": { "200": { "description": "OK" } }
      },
      "delete": {
        "operationId": "deleteOrder",
        "tags": ["orders"],
        "responses": { "204": { "description": "Deleted" } }
      }
    }
  }
}`

const swagger2Spec = `{
  "swagger": "2.0",
  "info": {
    "title": "Legacy Payments Service",
    "version": "2.0.0"
  },
  "paths": {
    "/payments": {
      "post": {
        "operationId": "processPayment",
        "tags": ["payments"],
        "responses": { "200": { "description": "OK" } }
      }
    },
    "/payments/{payment_id}": {
      "get": {
        "operationId": "getPayment",
        "tags": ["payments"],
        "responses": { "200": { "description": "OK" } }
      }
    }
  }
}`

func TestOpenAPIParser_ParseBytes_OpenAPI3(t *testing.T) {
	parser := discovery.NewOpenAPIParser(nil)

	routes, serviceName, err := parser.ParseBytes([]byte(openAPI3Spec))
	require.NoError(t, err)
	assert.Equal(t, "acme-orders-api", serviceName)
	assert.Len(t, routes, 4)

	// Verify route mapping
	routeMap := make(map[string]discovery.DiscoveredRoute)
	for _, r := range routes {
		routeMap[r.Method+" "+r.PathTemplate] = r
	}

	assert.Contains(t, routeMap, "GET /orders")
	assert.Contains(t, routeMap, "POST /orders")
	assert.Contains(t, routeMap, "GET /orders/{id}")
	assert.Contains(t, routeMap, "DELETE /orders/{id}")

	postOrder := routeMap["POST /orders"]
	assert.ElementsMatch(t, []string{"orders", "checkout"}, postOrder.Tags)
	assert.Equal(t, "createOrder", postOrder.OperationID)
}

func TestOpenAPIParser_ParseBytes_Swagger2(t *testing.T) {
	parser := discovery.NewOpenAPIParser(nil)

	routes, serviceName, err := parser.ParseBytes([]byte(swagger2Spec))
	require.NoError(t, err)
	assert.Equal(t, "legacy-payments-service", serviceName)
	assert.Len(t, routes, 2)

	routeMap := make(map[string]discovery.DiscoveredRoute)
	for _, r := range routes {
		routeMap[r.Method+" "+r.PathTemplate] = r
	}

	assert.Contains(t, routeMap, "POST /payments")
	assert.Contains(t, routeMap, "GET /payments/{payment_id}")
}

func TestOpenAPIParser_ParseBytes_Errors(t *testing.T) {
	parser := discovery.NewOpenAPIParser(nil)

	t.Run("Empty bytes", func(t *testing.T) {
		_, _, err := parser.ParseBytes([]byte(""))
		require.Error(t, err)
	})

	t.Run("Malformed JSON", func(t *testing.T) {
		_, _, err := parser.ParseBytes([]byte("{ invalid json }"))
		require.Error(t, err)
	})
}
