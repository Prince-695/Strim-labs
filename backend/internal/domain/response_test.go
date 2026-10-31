package domain_test

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResponseEnvelopeSuccess(t *testing.T) {
	app := fiber.New()
	app.Get("/test", func(c *fiber.Ctx) error {
		c.Locals("requestID", "req_test123")
		return domain.SendOK(c, fiber.Map{"foo": "bar"}, &domain.PageMeta{Limit: 50, HasMore: false})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var body domain.Response
	err = json.NewDecoder(resp.Body).Decode(&body)
	require.NoError(t, err)

	assert.True(t, body.Success)
	assert.Equal(t, "req_test123", body.RequestID)
	assert.NotNil(t, body.Meta)
	assert.Equal(t, 50, body.Meta.Limit)
	assert.False(t, body.Meta.HasMore)
}

func TestResponseEnvelopeError(t *testing.T) {
	app := fiber.New()
	app.Get("/error", func(c *fiber.Ctx) error {
		c.Locals("requestID", "req_err456")
		return domain.SendError(c, fiber.StatusBadRequest, domain.ErrCodeValidationFailed, "Field is required", fiber.Map{"field": "name"})
	})

	req := httptest.NewRequest("GET", "/error", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	var body domain.Response
	err = json.NewDecoder(resp.Body).Decode(&body)
	require.NoError(t, err)

	assert.False(t, body.Success)
	assert.Equal(t, domain.ErrCodeValidationFailed, body.ErrorCode)
	assert.Equal(t, "Field is required", body.Error)
	assert.Equal(t, "req_err456", body.RequestID)
	assert.NotNil(t, body.Details)
}
