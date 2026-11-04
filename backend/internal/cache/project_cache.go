package cache

import (
	"fmt"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// ProjectCache manages 60-second in-memory caching of project settings with instant invalidation.
type ProjectCache interface {
	GetProject(orgID, projectID string) (*domain.Project, bool)
	SetProject(orgID, projectID string, project *domain.Project, ttl time.Duration)
	Invalidate(orgID, projectID string)
}

type projectCache struct {
	cache Cache
}

// NewProjectCache creates a ProjectCache backed by the underlying memory cache.
func NewProjectCache(cache Cache) ProjectCache {
	return &projectCache{cache: cache}
}

func (p *projectCache) key(orgID, projectID string) string {
	return fmt.Sprintf("project:%s:%s", orgID, projectID)
}

func (p *projectCache) GetProject(orgID, projectID string) (*domain.Project, bool) {
	val, ok := p.cache.Get(p.key(orgID, projectID))
	if !ok {
		return nil, false
	}
	proj, ok := val.(*domain.Project)
	return proj, ok
}

func (p *projectCache) SetProject(orgID, projectID string, project *domain.Project, ttl time.Duration) {
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	p.cache.Set(p.key(orgID, projectID), project, ttl)
}

func (p *projectCache) Invalidate(orgID, projectID string) {
	p.cache.Delete(p.key(orgID, projectID))
}
