package strim

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Client buffers and asynchronously delivers telemetry events to STRIM Labs.
type Client struct {
	cfg       Config
	queue     chan Event
	httpClient *http.Client
	done      chan struct{}
	wg        sync.WaitGroup
}

// NewClient initializes a Strim client with a background worker.
func NewClient(cfg Config) *Client {
	if cfg.APIKey == "" {
		cfg.APIKey = os.Getenv("STRIM_API_KEY")
	}
	if cfg.Endpoint == "" {
		cfg.Endpoint = os.Getenv("STRIM_ENDPOINT")
		if cfg.Endpoint == "" {
			cfg.Endpoint = "https://api.strimlabs.com"
		}
	}
	cfg.Endpoint = strings.TrimRight(cfg.Endpoint, "/")

	if cfg.Service == "" {
		cfg.Service = os.Getenv("STRIM_SERVICE")
		if cfg.Service == "" {
			cfg.Service = "api"
		}
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 50
	}
	if cfg.FlushInterval <= 0 {
		cfg.FlushInterval = 2 * time.Second
	}

	c := &Client{
		cfg:        cfg,
		queue:      make(chan Event, 5000),
		httpClient: &http.Client{Timeout: 5 * time.Second},
		done:       make(chan struct{}),
	}

	c.wg.Add(1)
	go c.worker()

	return c
}

// Record queues an event for delivery. It is completely non-blocking.
func (c *Client) Record(event Event) {
	if c.cfg.APIKey == "" {
		return
	}
	if event.TS.IsZero() {
		event.TS = time.Now().UTC()
	}
	event.Error = event.Status >= 400 || event.Status == 0

	select {
	case c.queue <- event:
	default:
		// Queue full: drop event rather than blocking application execution
		if c.cfg.Debug {
			fmt.Println("[STRIM Labs] Warning: buffer full, dropping event")
		}
	}
}

// Close flushes any remaining events and shuts down background worker.
func (c *Client) Close() {
	close(c.done)
	c.wg.Wait()
}

func (c *Client) worker() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.cfg.FlushInterval)
	defer ticker.Stop()

	batch := make([]Event, 0, c.cfg.BatchSize)

	flush := func() {
		if len(batch) == 0 {
			return
		}
		toSend := batch
		batch = make([]Event, 0, c.cfg.BatchSize)
		c.send(toSend)
	}

	for {
		select {
		case ev := <-c.queue:
			batch = append(batch, ev)
			if len(batch) >= c.cfg.BatchSize {
				flush()
			}
		case <-ticker.C:
			flush()
		case <-c.done:
			// Drain remaining events
			for {
				select {
				case ev := <-c.queue:
					batch = append(batch, ev)
					if len(batch) >= c.cfg.BatchSize {
						flush()
					}
				default:
					flush()
					return
				}
			}
		}
	}
}

func (c *Client) send(events []Event) {
	if len(events) == 0 || c.cfg.APIKey == "" {
		return
	}

	payload := ingestPayload{
		Service: c.cfg.Service,
		Events:  events,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	url := fmt.Sprintf("%s/v1/ingest/events", c.cfg.Endpoint)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.cfg.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		if c.cfg.Debug {
			fmt.Printf("[STRIM Labs] Failed to send telemetry batch: %v\n", err)
		}
		return
	}
	defer resp.Body.Close()

	if c.cfg.Debug && resp.StatusCode >= 300 {
		fmt.Printf("[STRIM Labs] Ingest response status: %s\n", resp.Status)
	}
}
