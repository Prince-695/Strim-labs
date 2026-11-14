package service

import (
	"context"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// AuditService provides read-only query access to the immutable audit logs.
type AuditService struct {
	auditRepo repository.AuditLogRepository
	orgRepo   repository.OrgRepository
}

// NewAuditService initializes an AuditService.
func NewAuditService(auditRepo repository.AuditLogRepository, orgRepo repository.OrgRepository) *AuditService {
	return &AuditService{
		auditRepo: auditRepo,
		orgRepo:   orgRepo,
	}
}

// ListAuditLogs queries the audit logs for an organization matching filter parameters.
func (s *AuditService) ListAuditLogs(ctx context.Context, orgID string, filter domain.AuditLogFilter) ([]domain.AuditLogResponse, error) {
	if _, err := s.orgRepo.FindByID(ctx, orgID); err != nil {
		return nil, err
	}

	filter.OrgID = orgID
	logs, err := s.auditRepo.List(ctx, filter)
	if err != nil {
		return nil, err
	}

	resp := make([]domain.AuditLogResponse, 0, len(logs))
	for _, l := range logs {
		resp = append(resp, domain.ToAuditLogResponse(l))
	}
	return resp, nil
}
