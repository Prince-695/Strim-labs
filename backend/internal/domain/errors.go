package domain

import (
	"errors"
	"fmt"
	"log/slog"

	"github.com/gofiber/fiber/v2"
)

// Standard error codes per PRD Section 11.3 & API Section 22
const (
	ErrCodeValidationFailed      = "VALIDATION_FAILED"
	ErrCodeBadRequest            = "BAD_REQUEST"
	ErrCodeUnauthorized          = "UNAUTHORIZED"
	ErrCodeInvalidCredentials    = "INVALID_CREDENTIALS"
	ErrCodeTokenExpired          = "TOKEN_EXPIRED"
	ErrCodeTokenInvalid          = "TOKEN_INVALID"
	ErrCodeTokenReused           = "TOKEN_REUSED"
	ErrCodeInvalidAPIKey         = "INVALID_API_KEY"
	ErrCodeEmailNotVerified      = "EMAIL_NOT_VERIFIED"
	ErrCodeForbiddenRole         = "FORBIDDEN_ROLE"
	ErrCodeKeyScopeMissing       = "KEY_SCOPE_MISSING"
	ErrCodeNotFound              = "NOT_FOUND"
	ErrCodeUserNotFound          = "USER_NOT_FOUND"
	ErrCodeEmailTaken            = "EMAIL_TAKEN"
	ErrCodeUsernameTaken         = "USERNAME_TAKEN"
	ErrCodeUsernameAlreadySet    = "USERNAME_ALREADY_SET"
	ErrCodeSlugTaken             = "SLUG_TAKEN"
	ErrCodeAlreadyMember         = "ALREADY_MEMBER"
	ErrCodeAlreadyVerified       = "ALREADY_VERIFIED"
	ErrCodeOrgLimitReached       = "ORG_LIMIT_REACHED"
	ErrCodeTargetOrgLimitReached = "TARGET_ORG_LIMIT_REACHED"
	ErrCodeProjectLimitReached   = "PROJECT_LIMIT_REACHED"
	ErrCodeTestAlreadyRunning    = "TEST_ALREADY_RUNNING"
	ErrCodeTestRunning           = "TEST_RUNNING"
	ErrCodeTestNotFinished       = "TEST_NOT_FINISHED"
	ErrCodeVersionConflict       = "VERSION_CONFLICT"
	ErrCodeOTPInvalid            = "OTP_INVALID"
	ErrCodeOTPExpired            = "OTP_EXPIRED"
	ErrCodeOTPAttemptsExceeded   = "OTP_ATTEMPTS_EXCEEDED"
	ErrCodeInvalidPassword       = "INVALID_PASSWORD"
	ErrCodeLastOwner             = "LAST_OWNER"
	ErrCodeConfirmationMismatch  = "CONFIRMATION_MISMATCH"
	ErrCodeNotRunning            = "NOT_RUNNING"
	ErrCodeTargetNotVerified     = "TARGET_NOT_VERIFIED"
	ErrCodeTargetBlocked         = "TARGET_BLOCKED"
	ErrCodePlanLimitExceeded     = "PLAN_LIMIT_EXCEEDED"
	ErrCodeAccountLocked         = "ACCOUNT_LOCKED"
	ErrCodeRateLimited           = "RATE_LIMITED"
	ErrCodeIngestBackpressure    = "INGEST_BACKPRESSURE"
	ErrCodeInternalError         = "INTERNAL_ERROR"
	ErrCodeServiceUnavailable    = "SERVICE_UNAVAILABLE"
)

// AppError represents a structured, domain-aware application error.
type AppError struct {
	HTTPStatus  int         `json:"-"`
	ErrorCode   string      `json:"error_code"`
	Message     string      `json:"message"`
	Details     interface{} `json:"details,omitempty"`
	InternalErr error       `json:"-"` // Never serialized to client
}

// Error implements the standard error interface.
func (e *AppError) Error() string {
	if e.InternalErr != nil {
		return fmt.Sprintf("[%s] %s: %v", e.ErrorCode, e.Message, e.InternalErr)
	}
	return fmt.Sprintf("[%s] %s", e.ErrorCode, e.Message)
}

// Unwrap returns the underlying wrapped error.
func (e *AppError) Unwrap() error {
	return e.InternalErr
}

// Factory functions for standard application errors
func NewAppError(status int, code, message string, internalErr error) *AppError {
	return &AppError{
		HTTPStatus:  status,
		ErrorCode:   code,
		Message:     message,
		InternalErr: internalErr,
	}
}

func NewValidationError(message string, details interface{}) *AppError {
	return &AppError{
		HTTPStatus: fiber.StatusBadRequest,
		ErrorCode:  ErrCodeValidationFailed,
		Message:    message,
		Details:    details,
	}
}

func NewBadRequestError(message string, err error) *AppError {
	return NewAppError(fiber.StatusBadRequest, ErrCodeBadRequest, message, err)
}

func NewUnauthorizedError(message string) *AppError {
	return NewAppError(fiber.StatusUnauthorized, ErrCodeUnauthorized, message, nil)
}

func NewForbiddenError(code, message string) *AppError {
	return NewAppError(fiber.StatusForbidden, code, message, nil)
}

func NewNotFoundError(message string) *AppError {
	return NewAppError(fiber.StatusNotFound, ErrCodeNotFound, message, nil)
}

func NewConflictError(code, message string) *AppError {
	return NewAppError(fiber.StatusConflict, code, message, nil)
}

func NewInternalError(err error) *AppError {
	return NewAppError(fiber.StatusInternalServerError, ErrCodeInternalError, "An unexpected internal error occurred", err)
}

func NewServiceUnavailableError(message string, err error) *AppError {
	return NewAppError(fiber.StatusServiceUnavailable, ErrCodeServiceUnavailable, message, err)
}

// CentralErrorHandler creates a Fiber error handler that guarantees every failure
// is encapsulated inside domain.Response and never leaks internal details.
func CentralErrorHandler(logger *slog.Logger) fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		reqID := GetRequestID(c)

		// Check if it's our typed AppError
		var appErr *AppError
		if errors.As(err, &appErr) {
			if appErr.HTTPStatus >= 500 {
				logger.Error("Server error",
					slog.String("request_id", reqID),
					slog.String("error_code", appErr.ErrorCode),
					slog.String("message", appErr.Message),
					slog.Any("error", appErr.InternalErr),
				)
			} else {
				logger.Warn("Client error",
					slog.String("request_id", reqID),
					slog.String("error_code", appErr.ErrorCode),
					slog.String("message", appErr.Message),
				)
			}
			return SendError(c, appErr.HTTPStatus, appErr.ErrorCode, appErr.Message, appErr.Details)
		}

		// Check if it's a Fiber built-in HTTP error (e.g., 404, 405, 413)
		var fiberErr *fiber.Error
		if errors.As(err, &fiberErr) {
			errorCode := ErrCodeBadRequest
			switch fiberErr.Code {
			case fiber.StatusNotFound:
				errorCode = ErrCodeNotFound
			case fiber.StatusMethodNotAllowed:
				errorCode = ErrCodeBadRequest
			case fiber.StatusRequestEntityTooLarge:
				errorCode = ErrCodeBadRequest
			case fiber.StatusTooManyRequests:
				errorCode = ErrCodeRateLimited
			case fiber.StatusInternalServerError:
				errorCode = ErrCodeInternalError
			}

			if fiberErr.Code >= 500 {
				logger.Error("Fiber server error",
					slog.String("request_id", reqID),
					slog.Int("status", fiberErr.Code),
					slog.String("error", fiberErr.Message),
				)
			}
			return SendError(c, fiberErr.Code, errorCode, fiberErr.Message, nil)
		}

		// Fallback for unhandled errors
		logger.Error("Unhandled error caught by central handler",
			slog.String("request_id", reqID),
			slog.Any("error", err),
		)

		return SendError(c, fiber.StatusInternalServerError, ErrCodeInternalError, "An internal server error occurred", nil)
	}
}
