package domain

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Response defines the universal envelope for all API responses per PRD 11.1 and API 1.3.
type Response struct {
	Success      bool        `json:"success"`
	Message      string      `json:"message,omitempty"`
	AccessToken  string      `json:"access_token,omitempty"`
	Data         interface{} `json:"data,omitempty"`
	Error        string      `json:"error,omitempty"`
	ErrorCode    string      `json:"error_code,omitempty"`
	Details      interface{} `json:"details,omitempty"`
	Meta         *PageMeta   `json:"meta,omitempty"`
	RequestID    string      `json:"request_id,omitempty"`
	ResponseTime string      `json:"response_time"`
}

// PageMeta defines standard cursor-based pagination metadata.
type PageMeta struct {
	Limit      int    `json:"limit" example:"50"`
	NextCursor string `json:"next_cursor,omitempty" example:"0192f1b2-7c1e-7a3b-9d0a-3f5b6c7d8e9f"`
	HasMore    bool   `json:"has_more" example:"false"`
	Total      *int   `json:"total,omitempty" example:"120"`
}

// ComputeDuration computes the formatted elapsed duration from request start time stored in fiber locals.
func ComputeDuration(c *fiber.Ctx) string {
	if startVal := c.Locals("startTime"); startVal != nil {
		if startTime, ok := startVal.(time.Time); ok {
			duration := time.Since(startTime)
			if duration < time.Millisecond {
				return fmt.Sprintf("%dµs", duration.Microseconds())
			}
			return fmt.Sprintf("%.2fms", float64(duration.Microseconds())/1000.0)
		}
	}
	return "0ms"
}

// GetRequestID returns the request ID from fiber locals or header.
func GetRequestID(c *fiber.Ctx) string {
	if reqID := c.Locals("requestID"); reqID != nil {
		if idStr, ok := reqID.(string); ok && idStr != "" {
			return idStr
		}
	}
	return c.Get("X-Request-ID")
}

// SendSuccess writes a standardized successful response envelope.
func SendSuccess(c *fiber.Ctx, statusCode int, data interface{}, meta *PageMeta, message string) error {
	resp := Response{
		Success:      true,
		Message:      message,
		Data:         data,
		Meta:         meta,
		RequestID:    GetRequestID(c),
		ResponseTime: ComputeDuration(c),
	}
	return c.Status(statusCode).JSON(resp)
}

// SendOK sends a 200 OK response with data and optional meta.
func SendOK(c *fiber.Ctx, data interface{}, meta *PageMeta) error {
	return SendSuccess(c, fiber.StatusOK, data, meta, "")
}

// SendCreated sends a 201 Created response with data.
func SendCreated(c *fiber.Ctx, data interface{}) error {
	return SendSuccess(c, fiber.StatusCreated, data, nil, "Resource created successfully")
}

// SendError writes a standardized error response envelope.
func SendError(c *fiber.Ctx, statusCode int, errorCode, message string, details interface{}) error {
	resp := Response{
		Success:      false,
		Error:        message,
		ErrorCode:    errorCode,
		Details:      details,
		RequestID:    GetRequestID(c),
		ResponseTime: ComputeDuration(c),
	}
	return c.Status(statusCode).JSON(resp)
}
