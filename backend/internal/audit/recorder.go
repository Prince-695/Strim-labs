package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/repository"
)

type contextKey string

const (
	ActorIDKey    contextKey = "audit_actor_id"
	ActorEmailKey contextKey = "audit_actor_email"
	ClientIPKey   contextKey = "audit_client_ip"
	UserAgentKey  contextKey = "audit_user_agent"
)

// WithAuditContext returns a context enriched with actor and client metadata.
func WithAuditContext(ctx context.Context, actorID, actorEmail, ip, userAgent string) context.Context {
	ctx = context.WithValue(ctx, ActorIDKey, actorID)
	ctx = context.WithValue(ctx, ActorEmailKey, actorEmail)
	ctx = context.WithValue(ctx, ClientIPKey, ip)
	ctx = context.WithValue(ctx, UserAgentKey, userAgent)
	return ctx
}

// Recorder defines operations to write append-only audit entries.
type Recorder interface {
	Record(ctx context.Context, orgID, actorID, actorEmail, action, resourceType, resourceID, ip, userAgent string, before, after interface{})
	RecordFromContext(ctx context.Context, orgID, action, resourceType, resourceID string, before, after interface{})
}

// AsyncRecorder records audit logs asynchronously into AuditLogRepository.
type AsyncRecorder struct {
	repo  repository.AuditLogRepository
	idGen ids.IDGenerator
}

// NewAsyncRecorder creates a new AsyncRecorder instance.
func NewAsyncRecorder(repo repository.AuditLogRepository) *AsyncRecorder {
	return &AsyncRecorder{
		repo:  repo,
		idGen: ids.NewUUIDv7Generator(),
	}
}

// Record persists an immutable audit log entry.
func (r *AsyncRecorder) Record(ctx context.Context, orgID, actorID, actorEmail, action, resourceType, resourceID, ip, userAgent string, before, after interface{}) {
	var changesStr string
	if before != nil || after != nil {
		changes := map[string]interface{}{}
		if before != nil {
			changes["before"] = before
		}
		if after != nil {
			changes["after"] = after
		}
		bytes, _ := json.Marshal(changes)
		changesStr = string(bytes)
	}

	if actorID == "" {
		actorID = "system"
	}
	if actorEmail == "" {
		actorEmail = "system@strimlabs.dev"
	}

	log := &domain.AuditLog{
		ID:           r.idGen.MustNewUUIDv7(),
		OrgID:        orgID,
		At:           time.Now(),
		ActorID:      actorID,
		ActorEmail:   actorEmail,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		IP:           ip,
		UserAgent:    userAgent,
		Changes:      changesStr,
	}

	_ = r.repo.Append(context.Background(), log)
}

// RecordFromContext records an audit entry extracting actor and client details from context.
func (r *AsyncRecorder) RecordFromContext(ctx context.Context, orgID, action, resourceType, resourceID string, before, after interface{}) {
	actorID, _ := ctx.Value(ActorIDKey).(string)
	actorEmail, _ := ctx.Value(ActorEmailKey).(string)
	ip, _ := ctx.Value(ClientIPKey).(string)
	userAgent, _ := ctx.Value(UserAgentKey).(string)

	r.Record(ctx, orgID, actorID, actorEmail, action, resourceType, resourceID, ip, userAgent, before, after)
}
