package loadengine

import (
	"context"
	"crypto/tls"
	"io"
	"math/rand"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// Dispatcher defines the interface for selecting and executing HTTP requests against targets.
type Dispatcher interface {
	SelectTarget() domain.LoadTestTarget
	Dispatch(ctx context.Context, target domain.LoadTestTarget, timeout time.Duration) (int, int64, error)
}

// HTTPDispatcher executes HTTP requests with connection pooling and weighted target selection.
type HTTPDispatcher struct {
	client      *http.Client
	baseURL     string
	targets     []domain.LoadTestTarget
	totalWeight int
	rnd         *rand.Rand
}

// NewHTTPDispatcher initializes a tuned HTTP dispatcher.
func NewHTTPDispatcher(baseURL string, targets []domain.LoadTestTarget, customTransport *http.Transport) *HTTPDispatcher {
	if len(targets) == 0 {
		targets = []domain.LoadTestTarget{{Method: "GET", Path: "/", Weight: 1}}
	}

	totalWeight := 0
	normalizedTargets := make([]domain.LoadTestTarget, len(targets))
	for i, t := range targets {
		w := t.Weight
		if w <= 0 {
			w = 1
		}
		t.Weight = w
		normalizedTargets[i] = t
		totalWeight += w
	}

	transport := customTransport
	if transport == nil {
		transport = &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   5 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          2000,
			MaxIdleConnsPerHost:   500,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			TLSClientConfig: &tls.Config{
				MinVersion: tls.VersionTLS12,
			},
		}
	}

	client := &http.Client{
		Transport: transport,
	}

	return &HTTPDispatcher{
		client:      client,
		baseURL:     strings.TrimRight(baseURL, "/"),
		targets:     normalizedTargets,
		totalWeight: totalWeight,
		rnd:         rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// SelectTarget returns an endpoint target chosen by weighted random distribution.
func (d *HTTPDispatcher) SelectTarget() domain.LoadTestTarget {
	if len(d.targets) == 1 {
		return d.targets[0]
	}

	r := d.rnd.Intn(d.totalWeight)
	accum := 0
	for _, t := range d.targets {
		accum += t.Weight
		if r < accum {
			return t
		}
	}
	return d.targets[0]
}

// Dispatch executes an HTTP request to the target, returning status code and response byte size.
func (d *HTTPDispatcher) Dispatch(ctx context.Context, target domain.LoadTestTarget, timeout time.Duration) (int, int64, error) {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	path := target.Path
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	fullURL := d.baseURL + path

	var bodyReader io.Reader
	if len(target.Body) > 0 {
		bodyReader = strings.NewReader(target.Body)
	}

	req, err := http.NewRequestWithContext(reqCtx, target.Method, fullURL, bodyReader)
	if err != nil {
		return 0, 0, err
	}

	req.Header.Set("User-Agent", "STRIM-LoadEngine/1.0 (+https://strimlabs.dev)")
	for k, v := range target.Headers {
		req.Header.Set(k, v)
	}

	resp, err := d.client.Do(req)
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()

	// Limit response consumption to 1MB to avoid memory bloat
	bytesRead, _ := io.Copy(io.Discard, io.LimitReader(resp.Body, 1024*1024))

	return resp.StatusCode, bytesRead, nil
}
