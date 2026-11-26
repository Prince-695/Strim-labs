# strim (Go SDK)

Zero-dependency Go middleware for STRIM Labs telemetry ingestion and runtime API discovery.

## Installation

```bash
go get github.com/Prince-695/strim/sdk/go
```

## Usage

### Standard `net/http`
```go
package main

import (
	"net/http"

	"github.com/Prince-695/strim/sdk/go"
)

func main() {
	client := strim.NewClient(strim.Config{
		APIKey:  "strim_live_xyz123",
		Service: "payment-api",
	})
	defer client.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/charge", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("charged"))
	})

	// Wrap handler with Strim Middleware
	http.ListenAndServe(":8080", strim.Middleware(client)(mux))
}
```

### Chi Router
```go
r := chi.NewRouter()
r.Use(strim.Middleware(client))
```
