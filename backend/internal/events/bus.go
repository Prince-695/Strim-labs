package events

import (
	"context"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// SystemEvent encapsulates any lifecycle event emitted across STRIM Labs.
type SystemEvent struct {
	ID        string                  `json:"id"`
	Type      domain.WebhookEventType `json:"type"`
	ProjectID string                  `json:"project_id"`
	OrgID     string                  `json:"org_id"`
	Data      interface{}             `json:"data"`
	Timestamp time.Time               `json:"timestamp"`
}

// Handler handles a dispatched system event.
type Handler func(ctx context.Context, event SystemEvent) error

// EventBus provides thread-safe in-process publish/subscribe mechanisms.
type EventBus interface {
	Publish(ctx context.Context, event SystemEvent)
	Subscribe(eventType domain.WebhookEventType, handler Handler)
	SubscribeAll(handler Handler)
	Close()
}

// InProcessBus implements EventBus backed by buffered Go channels and worker pools.
type InProcessBus struct {
	mu          sync.RWMutex
	handlers    map[domain.WebhookEventType][]Handler
	allHandlers []Handler
	eventsChan  chan SystemEvent
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc
}

// NewInProcessBus initializes a buffered asynchronous event bus.
func NewInProcessBus(bufferSize int, workers int) *InProcessBus {
	if bufferSize <= 0 {
		bufferSize = 1000
	}
	if workers <= 0 {
		workers = 4
	}

	ctx, cancel := context.WithCancel(context.Background())
	bus := &InProcessBus{
		handlers:   make(map[domain.WebhookEventType][]Handler),
		eventsChan: make(chan SystemEvent, bufferSize),
		ctx:        ctx,
		cancel:     cancel,
	}

	for i := 0; i < workers; i++ {
		bus.wg.Add(1)
		go bus.worker()
	}

	return bus
}

func (b *InProcessBus) worker() {
	defer b.wg.Done()
	for {
		select {
		case <-b.ctx.Done():
			return
		case event, ok := <-b.eventsChan:
			if !ok {
				return
			}
			b.dispatch(event)
		}
	}
}

func (b *InProcessBus) dispatch(event SystemEvent) {
	b.mu.RLock()
	var targets []Handler
	if specific, ok := b.handlers[event.Type]; ok {
		targets = append(targets, specific...)
	}
	targets = append(targets, b.allHandlers...)
	b.mu.RUnlock()

	for _, h := range targets {
		_ = h(b.ctx, event)
	}
}

// Publish enqueues a system event for asynchronous background processing.
func (b *InProcessBus) Publish(ctx context.Context, event SystemEvent) {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	select {
	case b.eventsChan <- event:
	default:
		// When queue is full, dispatch in a detached goroutine to avoid dropping or blocking
		go b.dispatch(event)
	}
}

// Subscribe registers a listener for a specific event type.
func (b *InProcessBus) Subscribe(eventType domain.WebhookEventType, handler Handler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[eventType] = append(b.handlers[eventType], handler)
}

// SubscribeAll registers a listener for all events.
func (b *InProcessBus) SubscribeAll(handler Handler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.allHandlers = append(b.allHandlers, handler)
}

// Close gracefully stops all worker goroutines.
func (b *InProcessBus) Close() {
	b.cancel()
	close(b.eventsChan)
	b.wg.Wait()
}
