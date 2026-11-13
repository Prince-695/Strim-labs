package sse

import (
	"errors"
	"fmt"
	"sync"
)

// Event represents a single Server-Sent Event payload.
type Event struct {
	ID    string `json:"id,omitempty"`
	Event string `json:"event"`
	Data  []byte `json:"data"`
}

const (
	DefaultMaxStreamsPerUser = 5
)

// ErrMaxStreamsExceeded is returned when a user exceeds the maximum concurrent streams per project.
var ErrMaxStreamsExceeded = errors.New("maximum concurrent SSE streams reached (limit: 5)")

// Hub manages active SSE connections grouped by topic and enforces per-user stream limits.
type Hub struct {
	mu          sync.RWMutex
	topics      map[string]map[*Client]struct{}
	userStreams map[string]int // key: "userID:projectID" -> count
	maxStreams  int
}

// NewHub constructs a new SSE topic hub.
func NewHub() *Hub {
	return &Hub{
		topics:      make(map[string]map[*Client]struct{}),
		userStreams: make(map[string]int),
		maxStreams:  DefaultMaxStreamsPerUser,
	}
}

// FormatTopic constructs standard namespaced topics.
func FormatTopic(projectID, subtopic string) string {
	if subtopic == "" {
		return fmt.Sprintf("projects:%s", projectID)
	}
	return fmt.Sprintf("projects:%s:%s", projectID, subtopic)
}

func userStreamKey(userID, projectID string) string {
	return fmt.Sprintf("%s:%s", userID, projectID)
}

// Subscribe registers a client to receive events for a specific topic, enforcing stream limits.
func (h *Hub) Subscribe(topic string, client *Client) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	key := userStreamKey(client.UserID, client.ProjectID)
	if client.UserID != "" && h.userStreams[key] >= h.maxStreams {
		return ErrMaxStreamsExceeded
	}

	if _, exists := h.topics[topic]; !exists {
		h.topics[topic] = make(map[*Client]struct{})
	}
	h.topics[topic][client] = struct{}{}

	if client.UserID != "" {
		h.userStreams[key]++
	}
	return nil
}

// Unsubscribe removes a client from a topic and decrements active stream counters.
func (h *Hub) Unsubscribe(topic string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, exists := h.topics[topic]; exists {
		if _, present := clients[client]; present {
			delete(clients, client)
			if len(clients) == 0 {
				delete(h.topics, topic)
			}

			if client.UserID != "" {
				key := userStreamKey(client.UserID, client.ProjectID)
				if h.userStreams[key] > 0 {
					h.userStreams[key]--
					if h.userStreams[key] == 0 {
						delete(h.userStreams, key)
					}
				}
			}
		}
	}
}

// Broadcast dispatches an event to all subscribers of a topic (ejecting slow clients if buffer is full).
func (h *Hub) Broadcast(topic string, event Event) {
	h.mu.RLock()
	clientsToEject := make([]*Client, 0)
	if clients, exists := h.topics[topic]; exists {
		for client := range clients {
			if client.IsClosed() {
				clientsToEject = append(clientsToEject, client)
				continue
			}

			select {
			case client.Send <- event:
			default:
				// Slow client buffer saturation -> disconnect to protect server
				client.Close()
				clientsToEject = append(clientsToEject, client)
			}
		}
	}
	h.mu.RUnlock()

	if len(clientsToEject) > 0 {
		for _, c := range clientsToEject {
			h.Unsubscribe(topic, c)
		}
	}
}

// SubscriberCount returns the current number of subscribers for a topic.
func (h *Hub) SubscriberCount(topic string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, exists := h.topics[topic]; exists {
		return len(clients)
	}
	return 0
}

// ActiveUserStreams returns the current number of active streams for a user and project.
func (h *Hub) ActiveUserStreams(userID, projectID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return h.userStreams[userStreamKey(userID, projectID)]
}

// CloseTopicClients closes all clients subscribed to a specific topic.
func (h *Hub) CloseTopicClients(topic string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, exists := h.topics[topic]; exists {
		for client := range clients {
			client.Close()
		}
	}
}
