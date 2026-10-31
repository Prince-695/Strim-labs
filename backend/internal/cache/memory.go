package cache

import (
	"sync"
	"time"
)

// Cache defines the interface for in-memory caching across STRIM services.
type Cache interface {
	Get(key string) (interface{}, bool)
	Set(key string, value interface{}, ttl time.Duration)
	Delete(key string)
	Flush()
}

type cacheItem struct {
	value      interface{}
	expiration time.Time
}

type memoryCache struct {
	mu    sync.RWMutex
	items map[string]cacheItem
}

// NewMemoryCache creates an in-memory thread-safe cache with TTL support.
func NewMemoryCache() Cache {
	c := &memoryCache{
		items: make(map[string]cacheItem),
	}
	// Background cleanup of expired keys every 60s
	go c.janitor(60 * time.Second)
	return c
}

func (c *memoryCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	item, found := c.items[key]
	c.mu.RUnlock()

	if !found {
		return nil, false
	}

	if !item.expiration.IsZero() && time.Now().After(item.expiration) {
		c.Delete(key)
		return nil, false
	}

	return item.value, true
}

func (c *memoryCache) Set(key string, value interface{}, ttl time.Duration) {
	var exp time.Time
	if ttl > 0 {
		exp = time.Now().Add(ttl)
	}

	c.mu.Lock()
	c.items[key] = cacheItem{
		value:      value,
		expiration: exp,
	}
	c.mu.Unlock()
}

func (c *memoryCache) Delete(key string) {
	c.mu.Lock()
	delete(c.items, key)
	c.mu.Unlock()
}

func (c *memoryCache) Flush() {
	c.mu.Lock()
	c.items = make(map[string]cacheItem)
	c.mu.Unlock()
}

func (c *memoryCache) janitor(interval time.Duration) {
	ticker := time.NewTicker(interval)
	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for k, v := range c.items {
			if !v.expiration.IsZero() && now.After(v.expiration) {
				delete(c.items, k)
			}
		}
		c.mu.Unlock()
	}
}
