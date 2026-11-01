package handlers

// Container holds all HTTP handler instances for dependency injection.
type Container struct {
	System *SystemHandler
	Auth   *AuthHandler
}

// NewContainer initializes a new Container with all handlers.
func NewContainer(system *SystemHandler, auth *AuthHandler) *Container {
	return &Container{
		System: system,
		Auth:   auth,
	}
}
