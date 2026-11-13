package handlers

// Container holds all HTTP handler instances for dependency injection.
type Container struct {
	System      *SystemHandler
	Auth        *AuthHandler
	User        *UserHandler
	Org         *OrgHandler
	Member      *MemberHandler
	Project     *ProjectHandler
	Endpoint    *EndpointHandler
	Discovery   *DiscoveryHandler
	Ingest      *IngestHandler
	Metrics     *MetricsHandler
	LoadTest    *LoadTestHandler
	Capacity    *CapacityHandler
	Diagnostics *DiagnosticsHandler
}

// NewContainer initializes a new Container with all handlers.
func NewContainer(
	system *SystemHandler,
	auth *AuthHandler,
	user *UserHandler,
	org *OrgHandler,
	member *MemberHandler,
	project *ProjectHandler,
	endpoint *EndpointHandler,
	discovery *DiscoveryHandler,
	ingest *IngestHandler,
	metrics *MetricsHandler,
	loadTest *LoadTestHandler,
	capacity *CapacityHandler,
	diagnostics *DiagnosticsHandler,
) *Container {
	return &Container{
		System:      system,
		Auth:        auth,
		User:        user,
		Org:         org,
		Member:      member,
		Project:     project,
		Endpoint:    endpoint,
		Discovery:   discovery,
		Ingest:      ingest,
		Metrics:     metrics,
		LoadTest:    loadTest,
		Capacity:    capacity,
		Diagnostics: diagnostics,
	}
}
