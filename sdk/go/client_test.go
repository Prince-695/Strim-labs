package strim_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prince-695/strim/sdk/go"
)

func TestMiddleware(t *testing.T) {
	client := strim.NewClient(strim.Config{
		APIKey:        "strim_test_key",
		Endpoint:      "http://localhost:8080",
		FlushInterval: 100 * time.Millisecond,
	})
	defer client.Close()

	handler := strim.Middleware(client)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
}
