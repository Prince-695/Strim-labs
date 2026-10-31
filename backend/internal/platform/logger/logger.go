package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

type contextKey string

const (
	RequestIDKey contextKey = "request_id"
	UserIDKey    contextKey = "user_id"
	OrgIDKey     contextKey = "org_id"
)

// ContextHandler wraps an slog.Handler to inject contextual fields (request_id, user_id, org_id) into every log record.
type ContextHandler struct {
	slog.Handler
}

// Handle extracts context values and appends them to the slog record before delegation.
func (h *ContextHandler) Handle(ctx context.Context, r slog.Record) error {
	if ctx != nil {
		if reqID, ok := ctx.Value(RequestIDKey).(string); ok && reqID != "" {
			r.AddAttrs(slog.String("request_id", reqID))
		}
		if userID, ok := ctx.Value(UserIDKey).(string); ok && userID != "" {
			r.AddAttrs(slog.String("user_id", userID))
		}
		if orgID, ok := ctx.Value(OrgIDKey).(string); ok && orgID != "" {
			r.AddAttrs(slog.String("org_id", orgID))
		}
	}
	return h.Handler.Handle(ctx, r)
}

// New creates a production-grade slog.Logger configured with JSON output and contextual attributes.
func New(levelStr string, w io.Writer) *slog.Logger {
	if w == nil {
		w = os.Stdout
	}

	var level slog.Level
	switch strings.ToLower(levelStr) {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level:     level,
		AddSource: level == slog.LevelDebug,
	}

	jsonHandler := slog.NewJSONHandler(w, opts)
	return slog.New(&ContextHandler{Handler: jsonHandler})
}

// WithRequestID returns a new context with the given request ID attached.
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, RequestIDKey, requestID)
}

// WithTenantContext returns a context with user and organization IDs attached for logging and tracing.
func WithTenantContext(ctx context.Context, userID, orgID string) context.Context {
	ctx = context.WithValue(ctx, UserIDKey, userID)
	return context.WithValue(ctx, OrgIDKey, orgID)
}
