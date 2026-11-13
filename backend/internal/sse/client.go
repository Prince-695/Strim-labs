package sse

import (
	"context"
	"sync/atomic"

	"github.com/google/uuid"
)

// DefaultClientBufferSize defines the buffered event channel capacity for each SSE connection.
const DefaultClientBufferSize = 64

// Client represents a single active Server-Sent Events subscriber connection.
type Client struct {
	ID        string
	UserID    string
	ProjectID string
	Send      chan Event
	Done      chan struct{}
	closed    atomic.Bool
	ctx       context.Context
	cancel    context.CancelFunc
}

// NewClient initializes a new SSE client for a specific user and project.
func NewClient(ctx context.Context, userID, projectID string) *Client {
	cCtx, cancel := context.WithCancel(ctx)
	return &Client{
		ID:        uuid.NewString(),
		UserID:    userID,
		ProjectID: projectID,
		Send:      make(chan Event, DefaultClientBufferSize),
		Done:      make(chan struct{}),
		ctx:       cCtx,
		cancel:    cancel,
	}
}

// Close gracefully closes the client channel and cancels its context.
func (c *Client) Close() {
	if c.closed.Swap(true) {
		return
	}
	c.cancel()
	close(c.Done)
}

// IsClosed returns whether the client has been closed.
func (c *Client) IsClosed() bool {
	return c.closed.Load()
}

// Context returns the client context.
func (c *Client) Context() context.Context {
	return c.ctx
}
