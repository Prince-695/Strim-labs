package strim

import (
	"net/http"
	"strings"
	"time"
)

type statusCapturingResponseWriter struct {
	http.ResponseWriter
	statusCode int
	bytes      int64
}

func (w *statusCapturingResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusCapturingResponseWriter) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.bytes += int64(n)
	return n, err
}

// Middleware returns a standard net/http middleware handler.
func Middleware(client *Client) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			rw := &statusCapturingResponseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			next.ServeHTTP(rw, r)

			duration := float64(time.Since(start).Microseconds()) / 1000.0

			path := r.URL.Path
			if path == "" {
				path = "/"
			}

			client.Record(Event{
				TS:         start.UTC(),
				Method:     strings.ToUpper(r.Method),
				Path:       path,
				Route:      path,
				Status:     rw.statusCode,
				DurationMS: duration,
				Bytes:      rw.bytes,
			})
		})
	}
}
