package sse

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHub_SubscribeUnsubscribe(t *testing.T) {
	hub := NewHub()
	topic := FormatTopic("proj-1", "metrics")

	client := NewClient(context.Background(), "user-1", "proj-1")
	defer client.Close()

	err := hub.Subscribe(topic, client)
	require.NoError(t, err)
	assert.Equal(t, 1, hub.SubscriberCount(topic))
	assert.Equal(t, 1, hub.ActiveUserStreams("user-1", "proj-1"))

	hub.Unsubscribe(topic, client)
	assert.Equal(t, 0, hub.SubscriberCount(topic))
	assert.Equal(t, 0, hub.ActiveUserStreams("user-1", "proj-1"))
}

func TestHub_MaxStreamsLimit(t *testing.T) {
	hub := NewHub()
	topic := FormatTopic("proj-limit", "metrics")

	var clients []*Client
	for i := 0; i < 5; i++ {
		c := NewClient(context.Background(), "user-limit", "proj-limit")
		clients = append(clients, c)
		err := hub.Subscribe(topic, c)
		require.NoError(t, err)
	}

	assert.Equal(t, 5, hub.ActiveUserStreams("user-limit", "proj-limit"))

	// 6th stream should be rejected with ErrMaxStreamsExceeded
	c6 := NewClient(context.Background(), "user-limit", "proj-limit")
	defer c6.Close()
	err := hub.Subscribe(topic, c6)
	require.ErrorIs(t, err, ErrMaxStreamsExceeded)

	// Clean up
	for _, c := range clients {
		hub.Unsubscribe(topic, c)
		c.Close()
	}
	assert.Equal(t, 0, hub.ActiveUserStreams("user-limit", "proj-limit"))
}

func TestHub_Broadcast(t *testing.T) {
	hub := NewHub()
	topic := FormatTopic("proj-broadcast", "metrics")

	c1 := NewClient(context.Background(), "u1", "proj-broadcast")
	c2 := NewClient(context.Background(), "u2", "proj-broadcast")
	defer c1.Close()
	defer c2.Close()

	require.NoError(t, hub.Subscribe(topic, c1))
	require.NoError(t, hub.Subscribe(topic, c2))

	event := Event{
		Event: "overview",
		Data:  []byte(`{"rps": 10.5}`),
	}

	hub.Broadcast(topic, event)

	select {
	case msg := <-c1.Send:
		assert.Equal(t, "overview", msg.Event)
		assert.Equal(t, `{"rps": 10.5}`, string(msg.Data))
	default:
		t.Fatal("c1 did not receive broadcast")
	}

	select {
	case msg := <-c2.Send:
		assert.Equal(t, "overview", msg.Event)
		assert.Equal(t, `{"rps": 10.5}`, string(msg.Data))
	default:
		t.Fatal("c2 did not receive broadcast")
	}
}

func TestHub_SlowClientEjection(t *testing.T) {
	hub := NewHub()
	topic := FormatTopic("proj-slow", "metrics")

	slowClient := NewClient(context.Background(), "u-slow", "proj-slow")
	require.NoError(t, hub.Subscribe(topic, slowClient))

	// Fill slow client's buffer to capacity
	for i := 0; i < DefaultClientBufferSize; i++ {
		slowClient.Send <- Event{Event: "fill", Data: []byte("x")}
	}

	// Next broadcast should trigger slow client ejection and close
	hub.Broadcast(topic, Event{Event: "overflow", Data: []byte("overflow")})

	assert.True(t, slowClient.IsClosed())
	assert.Equal(t, 0, hub.SubscriberCount(topic))
}
