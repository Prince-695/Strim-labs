package handlers

// Container holds all HTTP handler instances for dependency injection.
type Container struct {
	System *SystemHandler
}

// NewContainer initializes a new Container with all handlers.
func NewContainer(system *SystemHandler) *Container {
	return &Container{
		System: system,
	}
}
