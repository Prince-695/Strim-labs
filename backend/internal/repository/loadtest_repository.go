package repository

import (
	"context"
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"gorm.io/gorm"
)

// ListLoadTestsQuery defines filters and pagination parameters for listing load tests.
type ListLoadTestsQuery struct {
	Status  domain.LoadTestStatus
	Profile domain.LoadTestProfile
	Sort    string
	Limit   int
	Cursor  string
}

// LoadTestRepository manages persistence of load tests, results, and execution timeseries.
type LoadTestRepository interface {
	Create(ctx context.Context, test *domain.LoadTest) error
	Update(ctx context.Context, test *domain.LoadTest) error
	FindByID(ctx context.Context, testID string) (*domain.LoadTest, error)
	FindByProjectID(ctx context.Context, projectID string, query ListLoadTestsQuery) ([]*domain.LoadTest, int64, error)
	FindActiveByProjectID(ctx context.Context, projectID string) (*domain.LoadTest, error)
	FindActiveByOrgID(ctx context.Context, orgID string) (*domain.LoadTest, error)
	Delete(ctx context.Context, testID string) error
	CreateResults(ctx context.Context, results *domain.LoadTestResults) error
	GetResults(ctx context.Context, testID string) (*domain.LoadTestResults, error)
	CreateTimeseriesBatch(ctx context.Context, batch []*domain.LoadTestTimeseries) error
	GetTimeseries(ctx context.Context, testID string, stepSeconds int) ([]*domain.LoadTestTimeseries, error)
}

// JobRepository manages asynchronous background jobs.
type JobRepository interface {
	EnqueueJob(ctx context.Context, job *domain.Job) error
	ClaimJob(ctx context.Context, workerID string) (*domain.Job, error)
	HeartbeatJob(ctx context.Context, jobID, workerID string) error
	CompleteJob(ctx context.Context, jobID string) error
	FailJob(ctx context.Context, jobID string, lastError string) error
	ReclaimStaleJobs(ctx context.Context, olderThan time.Duration) (int64, error)
}

// GormLoadTestRepository implements LoadTestRepository using GORM / PostgreSQL.
type GormLoadTestRepository struct {
	db *database.DB
}

// NewLoadTestRepository instantiates a GORM load test repository.
func NewLoadTestRepository(db *database.DB) *GormLoadTestRepository {
	return &GormLoadTestRepository{db: db}
}

func (r *GormLoadTestRepository) Create(ctx context.Context, test *domain.LoadTest) error {
	return r.db.WithContext(ctx).Create(test).Error
}

func (r *GormLoadTestRepository) Update(ctx context.Context, test *domain.LoadTest) error {
	return r.db.WithContext(ctx).Save(test).Error
}

func (r *GormLoadTestRepository) FindByID(ctx context.Context, testID string) (*domain.LoadTest, error) {
	var test domain.LoadTest
	err := r.db.WithContext(ctx).First(&test, "id = ?", testID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &test, nil
}

func (r *GormLoadTestRepository) FindByProjectID(ctx context.Context, projectID string, query ListLoadTestsQuery) ([]*domain.LoadTest, int64, error) {
	db := r.db.WithContext(ctx).Model(&domain.LoadTest{}).Where("project_id = ?", projectID)

	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.Profile != "" {
		db = db.Where("profile = ?", query.Profile)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if query.Sort == "created_at" {
		db = db.Order("created_at ASC")
	} else {
		db = db.Order("created_at DESC")
	}

	limit := query.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	db = db.Limit(limit)

	var list []*domain.LoadTest
	if err := db.Find(&list).Error; err != nil {
		return nil, 0, err
	}

	return list, total, nil
}

func (r *GormLoadTestRepository) FindActiveByProjectID(ctx context.Context, projectID string) (*domain.LoadTest, error) {
	var test domain.LoadTest
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND status IN (?, ?)", projectID, domain.LoadTestStatusQueued, domain.LoadTestStatusRunning).
		First(&test).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &test, nil
}

func (r *GormLoadTestRepository) FindActiveByOrgID(ctx context.Context, orgID string) (*domain.LoadTest, error) {
	var test domain.LoadTest
	err := r.db.WithContext(ctx).
		Where("org_id = ? AND status IN (?, ?)", orgID, domain.LoadTestStatusQueued, domain.LoadTestStatusRunning).
		First(&test).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &test, nil
}

func (r *GormLoadTestRepository) Delete(ctx context.Context, testID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&domain.LoadTestTimeseries{}, "test_id = ?", testID).Error; err != nil {
			return err
		}
		if err := tx.Delete(&domain.LoadTestResults{}, "test_id = ?", testID).Error; err != nil {
			return err
		}
		return tx.Delete(&domain.LoadTest{}, "id = ?", testID).Error
	})
}

func (r *GormLoadTestRepository) CreateResults(ctx context.Context, results *domain.LoadTestResults) error {
	return r.db.WithContext(ctx).Create(results).Error
}

func (r *GormLoadTestRepository) GetResults(ctx context.Context, testID string) (*domain.LoadTestResults, error) {
	var res domain.LoadTestResults
	err := r.db.WithContext(ctx).First(&res, "test_id = ?", testID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &res, nil
}

func (r *GormLoadTestRepository) CreateTimeseriesBatch(ctx context.Context, batch []*domain.LoadTestTimeseries) error {
	if len(batch) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(batch, 100).Error
}

func (r *GormLoadTestRepository) GetTimeseries(ctx context.Context, testID string, stepSeconds int) ([]*domain.LoadTestTimeseries, error) {
	var points []*domain.LoadTestTimeseries
	err := r.db.WithContext(ctx).
		Where("test_id = ?", testID).
		Order("second ASC").
		Find(&points).Error
	if err != nil {
		return nil, err
	}

	if stepSeconds <= 1 || len(points) == 0 {
		return points, nil
	}

	// Downsample / aggregate by stepSeconds
	var stepped []*domain.LoadTestTimeseries
	for i := 0; i < len(points); i += stepSeconds {
		stepped = append(stepped, points[i])
	}
	return stepped, nil
}

// GormJobRepository implements JobRepository using GORM / PostgreSQL.
type GormJobRepository struct {
	db *database.DB
}

// NewJobRepository instantiates a GORM job repository.
func NewJobRepository(db *database.DB) *GormJobRepository {
	return &GormJobRepository{db: db}
}

func (r *GormJobRepository) EnqueueJob(ctx context.Context, job *domain.Job) error {
	return r.db.WithContext(ctx).Create(job).Error
}

func (r *GormJobRepository) ClaimJob(ctx context.Context, workerID string) (*domain.Job, error) {
	var claimed *domain.Job
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var job domain.Job
		now := time.Now().UTC()

		query := tx.Where("status = ? AND run_at <= ?", domain.JobStatusQueued, now).
			Order("run_at ASC")

		if r.db.Dialector.Name() == "postgres" {
			query = query.Set("gorm:query_option", "FOR UPDATE SKIP LOCKED")
		}

		if err := query.First(&job).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}

		job.Status = domain.JobStatusRunning
		job.LockedBy = &workerID
		job.LockedAt = &now
		job.Attempts++
		job.UpdatedAt = now

		if err := tx.Save(&job).Error; err != nil {
			return err
		}

		claimed = &job
		return nil
	})

	return claimed, err
}

func (r *GormJobRepository) HeartbeatJob(ctx context.Context, jobID, workerID string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&domain.Job{}).
		Where("id = ? AND locked_by = ?", jobID, workerID).
		Updates(map[string]interface{}{
			"locked_at":  now,
			"updated_at": now,
		}).Error
}

func (r *GormJobRepository) CompleteJob(ctx context.Context, jobID string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&domain.Job{}).
		Where("id = ?", jobID).
		Updates(map[string]interface{}{
			"status":     domain.JobStatusCompleted,
			"locked_by":  nil,
			"locked_at":  nil,
			"updated_at": now,
		}).Error
}

func (r *GormJobRepository) FailJob(ctx context.Context, jobID string, lastError string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&domain.Job{}).
		Where("id = ?", jobID).
		Updates(map[string]interface{}{
			"status":     domain.JobStatusFailed,
			"last_error": lastError,
			"locked_by":  nil,
			"locked_at":  nil,
			"updated_at": now,
		}).Error
}

func (r *GormJobRepository) ReclaimStaleJobs(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-olderThan)
	res := r.db.WithContext(ctx).Model(&domain.Job{}).
		Where("status = ? AND locked_at < ?", domain.JobStatusRunning, cutoff).
		Updates(map[string]interface{}{
			"status":     domain.JobStatusQueued,
			"locked_by":  nil,
			"locked_at":  nil,
			"updated_at": time.Now().UTC(),
		})
	return res.RowsAffected, res.Error
}

// InMemoryLoadTestRepository provides an in-memory, thread-safe implementation for tests.
type InMemoryLoadTestRepository struct {
	mu         sync.RWMutex
	tests      map[string]*domain.LoadTest
	results    map[string]*domain.LoadTestResults
	timeseries map[string][]*domain.LoadTestTimeseries
}

// NewInMemoryLoadTestRepository instantiates a new in-memory load test repo.
func NewInMemoryLoadTestRepository() *InMemoryLoadTestRepository {
	return &InMemoryLoadTestRepository{
		tests:      make(map[string]*domain.LoadTest),
		results:    make(map[string]*domain.LoadTestResults),
		timeseries: make(map[string][]*domain.LoadTestTimeseries),
	}
}

func (m *InMemoryLoadTestRepository) Create(ctx context.Context, test *domain.LoadTest) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := *test
	m.tests[test.ID] = &cp
	return nil
}

func (m *InMemoryLoadTestRepository) Update(ctx context.Context, test *domain.LoadTest) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := *test
	m.tests[test.ID] = &cp
	return nil
}

func (m *InMemoryLoadTestRepository) FindByID(ctx context.Context, testID string) (*domain.LoadTest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	test, exists := m.tests[testID]
	if !exists {
		return nil, nil
	}
	cp := *test
	return &cp, nil
}

func (m *InMemoryLoadTestRepository) FindByProjectID(ctx context.Context, projectID string, query ListLoadTestsQuery) ([]*domain.LoadTest, int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var matching []*domain.LoadTest
	for _, t := range m.tests {
		if t.ProjectID == projectID {
			if query.Status != "" && t.Status != query.Status {
				continue
			}
			if query.Profile != "" && t.Profile != query.Profile {
				continue
			}
			cp := *t
			matching = append(matching, &cp)
		}
	}

	sort.Slice(matching, func(i, j int) bool {
		if query.Sort == "created_at" {
			return matching[i].CreatedAt.Before(matching[j].CreatedAt)
		}
		return matching[i].CreatedAt.After(matching[j].CreatedAt)
	})

	total := int64(len(matching))
	limit := query.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if len(matching) > limit {
		matching = matching[:limit]
	}

	return matching, total, nil
}

func (m *InMemoryLoadTestRepository) FindActiveByProjectID(ctx context.Context, projectID string) (*domain.LoadTest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, t := range m.tests {
		if t.ProjectID == projectID && (t.Status == domain.LoadTestStatusQueued || t.Status == domain.LoadTestStatusRunning) {
			cp := *t
			return &cp, nil
		}
	}
	return nil, nil
}

func (m *InMemoryLoadTestRepository) FindActiveByOrgID(ctx context.Context, orgID string) (*domain.LoadTest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, t := range m.tests {
		if t.OrgID == orgID && (t.Status == domain.LoadTestStatusQueued || t.Status == domain.LoadTestStatusRunning) {
			cp := *t
			return &cp, nil
		}
	}
	return nil, nil
}

func (m *InMemoryLoadTestRepository) Delete(ctx context.Context, testID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.tests, testID)
	delete(m.results, testID)
	delete(m.timeseries, testID)
	return nil
}

func (m *InMemoryLoadTestRepository) CreateResults(ctx context.Context, results *domain.LoadTestResults) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.results[results.TestID] = results
	return nil
}

func (m *InMemoryLoadTestRepository) GetResults(ctx context.Context, testID string) (*domain.LoadTestResults, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res, exists := m.results[testID]
	if !exists {
		return nil, nil
	}
	return res, nil
}

func (m *InMemoryLoadTestRepository) CreateTimeseriesBatch(ctx context.Context, batch []*domain.LoadTestTimeseries) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, pt := range batch {
		m.timeseries[pt.TestID] = append(m.timeseries[pt.TestID], pt)
	}
	return nil
}

func (m *InMemoryLoadTestRepository) GetTimeseries(ctx context.Context, testID string, stepSeconds int) ([]*domain.LoadTestTimeseries, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	pts := m.timeseries[testID]
	if stepSeconds <= 1 || len(pts) == 0 {
		return pts, nil
	}

	var stepped []*domain.LoadTestTimeseries
	for i := 0; i < len(pts); i += stepSeconds {
		stepped = append(stepped, pts[i])
	}
	return stepped, nil
}

// InMemoryJobRepository provides an in-memory job queue for tests.
type InMemoryJobRepository struct {
	mu   sync.Mutex
	jobs map[string]*domain.Job
}

// NewInMemoryJobRepository instantiates an in-memory job queue.
func NewInMemoryJobRepository() *InMemoryJobRepository {
	return &InMemoryJobRepository{
		jobs: make(map[string]*domain.Job),
	}
}

func (m *InMemoryJobRepository) EnqueueJob(ctx context.Context, job *domain.Job) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.jobs[job.ID] = job
	return nil
}

func (m *InMemoryJobRepository) ClaimJob(ctx context.Context, workerID string) (*domain.Job, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	var candidates []*domain.Job
	for _, j := range m.jobs {
		if j.Status == domain.JobStatusQueued && (j.RunAt.Before(now) || j.RunAt.Equal(now)) {
			candidates = append(candidates, j)
		}
	}

	if len(candidates) == 0 {
		return nil, nil
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].RunAt.Before(candidates[j].RunAt)
	})

	claimed := candidates[0]
	claimed.Status = domain.JobStatusRunning
	claimed.LockedBy = &workerID
	claimed.LockedAt = &now
	claimed.Attempts++
	claimed.UpdatedAt = now

	return claimed, nil
}

func (m *InMemoryJobRepository) HeartbeatJob(ctx context.Context, jobID, workerID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	job, exists := m.jobs[jobID]
	if !exists {
		return nil
	}
	now := time.Now().UTC()
	job.LockedAt = &now
	job.UpdatedAt = now
	return nil
}

func (m *InMemoryJobRepository) CompleteJob(ctx context.Context, jobID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	job, exists := m.jobs[jobID]
	if !exists {
		return nil
	}
	now := time.Now().UTC()
	job.Status = domain.JobStatusCompleted
	job.LockedBy = nil
	job.LockedAt = nil
	job.UpdatedAt = now
	return nil
}

func (m *InMemoryJobRepository) FailJob(ctx context.Context, jobID string, lastError string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	job, exists := m.jobs[jobID]
	if !exists {
		return nil
	}
	now := time.Now().UTC()
	job.Status = domain.JobStatusFailed
	job.LastError = &lastError
	job.LockedBy = nil
	job.LockedAt = nil
	job.UpdatedAt = now
	return nil
}

func (m *InMemoryJobRepository) ReclaimStaleJobs(ctx context.Context, olderThan time.Duration) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	cutoff := time.Now().UTC().Add(-olderThan)
	var count int64
	for _, j := range m.jobs {
		if j.Status == domain.JobStatusRunning && j.LockedAt != nil && j.LockedAt.Before(cutoff) {
			j.Status = domain.JobStatusQueued
			j.LockedBy = nil
			j.LockedAt = nil
			j.UpdatedAt = time.Now().UTC()
			count++
		}
	}
	return count, nil
}
