package repository

import (
	"context"
	"encoding/base64"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EndpointRepository defines persistence operations for API endpoints, sources, and discovery runs.
type EndpointRepository interface {
	UpsertRoute(ctx context.Context, projectID string, route discovery.DiscoveredRoute, source domain.DiscoverySource, metadata domain.JSONMap) (*domain.APIEndpoint, bool, error)
	FindByID(ctx context.Context, projectID, endpointID string) (*domain.APIEndpoint, error)
	Update(ctx context.Context, projectID string, endpoint *domain.APIEndpoint) error
	List(ctx context.Context, projectID string, query domain.ListEndpointsQuery) ([]*domain.APIEndpoint, string, error)
	MarkStaleEndpoints(ctx context.Context, cutoff time.Time) (int64, error)

	CreateDiscoveryRun(ctx context.Context, run *domain.DiscoveryRun) error
	UpdateDiscoveryRun(ctx context.Context, run *domain.DiscoveryRun) error
	FindDiscoveryRunByID(ctx context.Context, projectID, runID string) (*domain.DiscoveryRun, error)
	ListDiscoveryRuns(ctx context.Context, projectID string, limit int) ([]*domain.DiscoveryRun, error)
}

// GormEndpointRepository implements EndpointRepository with GORM/PostgreSQL.
type GormEndpointRepository struct {
	db *database.DB
}

// NewEndpointRepository instantiates a GORM-backed endpoint repository.
func NewEndpointRepository(db *database.DB) *GormEndpointRepository {
	return &GormEndpointRepository{db: db}
}

// UpsertRoute merges or creates an endpoint record along with its discovery source provenance.
func (r *GormEndpointRepository) UpsertRoute(
	ctx context.Context,
	projectID string,
	route discovery.DiscoveredRoute,
	source domain.DiscoverySource,
	metadata domain.JSONMap,
) (*domain.APIEndpoint, bool, error) {
	var created bool
	var endpoint domain.APIEndpoint

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		method := discovery.NormalizeMethod(route.Method)
		pathTemplate := discovery.NormalizePath(route.PathTemplate)

		// 1. Look for existing endpoint
		err := tx.Where("project_id = ? AND method = ? AND path_template = ?", projectID, method, pathTemplate).
			First(&endpoint).Error

		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Create new endpoint
			created = true
			newID, idErr := uuid.NewV7()
			idStr := uuid.NewString()
			if idErr == nil {
				idStr = newID.String()
			}

			endpoint = domain.APIEndpoint{
				ID:           idStr,
				ProjectID:    projectID,
				Method:       method,
				PathTemplate: pathTemplate,
				Service:      route.Service,
				Tags:         domain.StringSlice(route.Tags),
				Status:       domain.EndpointStatusActive,
				FirstSeen:    now,
				LastSeen:     now,
			}

			if err := tx.Create(&endpoint).Error; err != nil {
				return err
			}
		} else {
			// Merge tags and update existing endpoint
			tagSet := make(map[string]struct{})
			var mergedTags []string
			for _, t := range endpoint.Tags {
				tagSet[t] = struct{}{}
				mergedTags = append(mergedTags, t)
			}
			for _, t := range route.Tags {
				if _, exists := tagSet[t]; !exists {
					tagSet[t] = struct{}{}
					mergedTags = append(mergedTags, t)
				}
			}

			service := endpoint.Service
			if service == "" && route.Service != "" {
				service = route.Service
			}

			endpoint.Tags = domain.StringSlice(mergedTags)
			endpoint.Service = service
			endpoint.LastSeen = now

			updates := map[string]interface{}{
				"tags":      endpoint.Tags,
				"service":   endpoint.Service,
				"last_seen": endpoint.LastSeen,
			}
			if err := tx.Model(&domain.APIEndpoint{}).Where("id = ?", endpoint.ID).Updates(updates).Error; err != nil {
				return err
			}
		}

		// 2. Upsert EndpointSource
		var src domain.EndpointSource
		srcErr := tx.Where("endpoint_id = ? AND source = ?", endpoint.ID, source).First(&src).Error
		if errors.Is(srcErr, gorm.ErrRecordNotFound) {
			newSrcID, _ := uuid.NewV7()
			srcIDStr := uuid.NewString()
			if newSrcID != uuid.Nil {
				srcIDStr = newSrcID.String()
			}
			src = domain.EndpointSource{
				ID:         srcIDStr,
				EndpointID: endpoint.ID,
				Source:     source,
				FirstSeen:  now,
				LastSeen:   now,
				Metadata:   metadata,
			}
			if err := tx.Create(&src).Error; err != nil {
				return err
			}
		} else if srcErr == nil {
			srcUpdates := map[string]interface{}{
				"last_seen": now,
				"metadata":  metadata,
			}
			if err := tx.Model(&domain.EndpointSource{}).Where("id = ?", src.ID).Updates(srcUpdates).Error; err != nil {
				return err
			}
		} else {
			return srcErr
		}

		return nil
	})

	if err != nil {
		return nil, false, err
	}
	return &endpoint, created, nil
}

// FindByID retrieves an endpoint with its discovery sources loaded.
func (r *GormEndpointRepository) FindByID(ctx context.Context, projectID, endpointID string) (*domain.APIEndpoint, error) {
	var endpoint domain.APIEndpoint
	err := r.db.WithContext(ctx).
		Preload("Sources", func(db *gorm.DB) *gorm.DB {
			return db.Order("last_seen DESC")
		}).
		Where("id = ? AND project_id = ?", endpointID, projectID).
		First(&endpoint).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.NewEndpointNotFoundError()
		}
		return nil, err
	}

	for _, s := range endpoint.Sources {
		endpoint.SourcesList = append(endpoint.SourcesList, string(s.Source))
	}
	return &endpoint, nil
}

// Update persists changes to mutable endpoint fields (tags, status, note).
func (r *GormEndpointRepository) Update(ctx context.Context, projectID string, endpoint *domain.APIEndpoint) error {
	result := r.db.WithContext(ctx).Model(&domain.APIEndpoint{}).
		Where("id = ? AND project_id = ?", endpoint.ID, projectID).
		Updates(map[string]interface{}{
			"tags":   endpoint.Tags,
			"status": endpoint.Status,
			"note":   endpoint.Note,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domain.NewEndpointNotFoundError()
	}
	return nil
}

// List queries endpoints with filtering, sorting, and keyset cursor pagination.
func (r *GormEndpointRepository) List(ctx context.Context, projectID string, query domain.ListEndpointsQuery) ([]*domain.APIEndpoint, string, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	dbQuery := r.db.WithContext(ctx).
		Model(&domain.APIEndpoint{}).
		Where("api_endpoints.project_id = ?", projectID)

	// Filter: q (search path or service)
	if q := strings.TrimSpace(query.Q); q != "" {
		likeQ := "%" + strings.ToLower(q) + "%"
		dbQuery = dbQuery.Where("(LOWER(api_endpoints.path_template) LIKE ? OR LOWER(api_endpoints.service) LIKE ?)", likeQ, likeQ)
	}

	// Filter: method
	if method := strings.TrimSpace(query.Method); method != "" {
		dbQuery = dbQuery.Where("api_endpoints.method = ?", strings.ToUpper(method))
	}

	// Filter: status
	if status := strings.TrimSpace(query.Status); status != "" {
		dbQuery = dbQuery.Where("api_endpoints.status = ?", status)
	}

	// Filter: service
	if service := strings.TrimSpace(query.Service); service != "" {
		dbQuery = dbQuery.Where("LOWER(api_endpoints.service) = ?", strings.ToLower(service))
	}

	// Filter: source (join endpoint_sources)
	if source := strings.TrimSpace(query.Source); source != "" {
		dbQuery = dbQuery.Joins("JOIN endpoint_sources ON endpoint_sources.endpoint_id = api_endpoints.id AND endpoint_sources.source = ?", source)
	}

	// Filter: tag
	if tag := strings.TrimSpace(query.Tag); tag != "" {
		dbQuery = dbQuery.Where("api_endpoints.tags::text LIKE ?", "%"+strings.ToLower(tag)+"%")
	}

	// Sorting
	orderClause := "api_endpoints.created_at DESC"
	switch query.Sort {
	case "path_template":
		orderClause = "api_endpoints.path_template ASC"
	case "-last_seen":
		orderClause = "api_endpoints.last_seen DESC"
	}

	// Keyset Cursor Pagination
	offset := 0
	if query.Cursor != "" {
		if decoded, err := base64.StdEncoding.DecodeString(query.Cursor); err == nil {
			if parsedOffset, err := strconv.Atoi(string(decoded)); err == nil && parsedOffset >= 0 {
				offset = parsedOffset
			}
		}
	}

	var endpoints []*domain.APIEndpoint
	err := dbQuery.
		Preload("Sources").
		Order(orderClause).
		Offset(offset).
		Limit(limit + 1).
		Find(&endpoints).Error
	if err != nil {
		return nil, "", err
	}

	var nextCursor string
	if len(endpoints) > limit {
		nextOffset := offset + limit
		nextCursor = base64.StdEncoding.EncodeToString([]byte(strconv.Itoa(nextOffset)))
		endpoints = endpoints[:limit]
	}

	for _, ep := range endpoints {
		for _, s := range ep.Sources {
			ep.SourcesList = append(ep.SourcesList, string(s.Source))
		}
	}

	return endpoints, nextCursor, nil
}

// MarkStaleEndpoints sets status='stale' for active endpoints not observed since cutoff.
func (r *GormEndpointRepository) MarkStaleEndpoints(ctx context.Context, cutoff time.Time) (int64, error) {
	result := r.db.WithContext(ctx).Model(&domain.APIEndpoint{}).
		Where("status = ? AND last_seen < ?", domain.EndpointStatusActive, cutoff).
		Update("status", domain.EndpointStatusStale)
	return result.RowsAffected, result.Error
}

// CreateDiscoveryRun persists a discovery run record.
func (r *GormEndpointRepository) CreateDiscoveryRun(ctx context.Context, run *domain.DiscoveryRun) error {
	if run.ID == "" {
		newID, err := uuid.NewV7()
		if err == nil {
			run.ID = newID.String()
		} else {
			run.ID = uuid.NewString()
		}
	}
	return r.db.WithContext(ctx).Create(run).Error
}

// UpdateDiscoveryRun updates a discovery run status and metrics.
func (r *GormEndpointRepository) UpdateDiscoveryRun(ctx context.Context, run *domain.DiscoveryRun) error {
	return r.db.WithContext(ctx).Model(run).
		Where("id = ?", run.ID).
		Updates(map[string]interface{}{
			"status":      run.Status,
			"found":       run.Found,
			"created":     run.Created,
			"updated":     run.Updated,
			"error":       run.Error,
			"metadata":    run.Metadata,
			"finished_at": run.FinishedAt,
		}).Error
}

// FindDiscoveryRunByID retrieves a discovery run by ID within a project.
func (r *GormEndpointRepository) FindDiscoveryRunByID(ctx context.Context, projectID, runID string) (*domain.DiscoveryRun, error) {
	var run domain.DiscoveryRun
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", runID, projectID).
		First(&run).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.NewNotFoundError("Discovery run not found")
		}
		return nil, err
	}
	return &run, nil
}

// ListDiscoveryRuns lists the most recent discovery runs for a project.
func (r *GormEndpointRepository) ListDiscoveryRuns(ctx context.Context, projectID string, limit int) ([]*domain.DiscoveryRun, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	var runs []*domain.DiscoveryRun
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("started_at DESC").
		Limit(limit).
		Find(&runs).Error
	if err != nil {
		return nil, err
	}
	return runs, nil
}
