package middleware

import (
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

type rateTracker struct {
	mu      sync.Mutex
	history map[string][]time.Time
}

var defaultTracker = &rateTracker{
	history: make(map[string][]time.Time),
}

// ResetRateLimiter clears all tracked IP sliding windows (useful in tests).
func ResetRateLimiter() {
	defaultTracker.mu.Lock()
	defer defaultTracker.mu.Unlock()
	defaultTracker.history = make(map[string][]time.Time)
}

// RateLimit creates a sliding-window rate limiter per client IP.
func RateLimit(limit int, window time.Duration) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ip := c.IP()
		key := fmt.Sprintf("%s:%s", c.Path(), ip)
		now := time.Now()
		windowStart := now.Add(-window)

		defaultTracker.mu.Lock()
		timestamps := defaultTracker.history[key]

		// Filter out timestamps outside window
		valid := make([]time.Time, 0, len(timestamps))
		for _, t := range timestamps {
			if t.After(windowStart) {
				valid = append(valid, t)
			}
		}

		currentCount := len(valid)
		remaining := limit - currentCount - 1
		if remaining < 0 {
			remaining = 0
		}

		resetSeconds := int(window.Seconds())
		if len(valid) > 0 {
			oldest := valid[0]
			resetSeconds = int(oldest.Add(window).Sub(now).Seconds())
			if resetSeconds < 1 {
				resetSeconds = 1
			}
		}

		c.Set("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Set("X-RateLimit-Reset", strconv.Itoa(resetSeconds))

		if currentCount >= limit {
			defaultTracker.history[key] = valid
			defaultTracker.mu.Unlock()

			c.Set("Retry-After", strconv.Itoa(resetSeconds))
			return domain.NewRateLimitedError(fmt.Sprintf("Rate limit of %d requests per %s exceeded. Please retry in %d seconds", limit, window, resetSeconds))
		}

		// Record current request
		valid = append(valid, now)
		defaultTracker.history[key] = valid
		defaultTracker.mu.Unlock()

		return c.Next()
	}
}
