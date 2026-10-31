package sse

import (
	"sync"
)

// Event represents a single Server-Sent Event payload.
type Event struct {
	ID    string `json:"id,omitempty"`
	Event string `json:"event"`
	Data  []byte `json:"data"`
}

// Hub manages active SSE connections grouped by topic.
type Hub struct {
	mu     sync.RWMutex
	topics map[string]map[chan Event]struct{}
}

// NewHub constructs a new SSE topic hub.
func NewHub() *Hub {
	return &Hub{
		topics: make(map[string]map[chan Event]struct{}),
	}
}

// Subscribe registers a client channel to receive events for a specific topic.
func (h *Hub) Subscribe(topic string, ch chan Event) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.topics[topic]; !exists {
		h.topics[topic] = make(map[chan Event]struct{})
	}
	h.topics[topic][ch] = struct{}{}
}

// Unsubscribe removes a client channel from a topic.
func (h *Hub) Unsubscribe(topic string, ch chan Event) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, exists := h.topics[topic]; exists {
		delete(clients, ch)
		if len(clients) == 0 {
			delete(h.topics, topic)
		}
	}
}

// Broadcast dispatches an event to all subscribers of a topic (non-blocking for slow clients).
func (h *Hub) Broadcast(topic string, event Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, exists := h.topics[topic]; exists {
		for ch := range clients {
			select {
			case ch <- event:
			default:
				// Bounded buffer drop for slow client to protect server memory
			}
		}
	}
}
