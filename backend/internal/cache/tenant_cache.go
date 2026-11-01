package cache

import (
	"fmt"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// TenantCache manages fast in-memory resolution of user membership and role within organizations.
type TenantCache interface {
	GetRole(orgID, userID string) (domain.OrgRole, bool)
	SetRole(orgID, userID string, role domain.OrgRole, ttl time.Duration)
	Invalidate(orgID, userID string)
}

type tenantCache struct {
	cache Cache
}

// NewTenantCache creates a TenantCache backed by the underlying memory cache.
func NewTenantCache(cache Cache) TenantCache {
	return &tenantCache{cache: cache}
}

func (t *tenantCache) key(orgID, userID string) string {
	return fmt.Sprintf("tenant:mem:%s:%s", orgID, userID)
}

func (t *tenantCache) GetRole(orgID, userID string) (domain.OrgRole, bool) {
	val, ok := t.cache.Get(t.key(orgID, userID))
	if !ok {
		return "", false
	}
	role, ok := val.(domain.OrgRole)
	return role, ok
}

func (t *tenantCache) SetRole(orgID, userID string, role domain.OrgRole, ttl time.Duration) {
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	t.cache.Set(t.key(orgID, userID), role, ttl)
}

func (t *tenantCache) Invalidate(orgID, userID string) {
	t.cache.Delete(t.key(orgID, userID))
}
