package redis

import (
	"sync"
	"time"
)

// ──────────────────────────────────────────────────────────────
// NearCache — in-process L1 cache (sync.Map + lazy expiry sweep)
// Ported from user-service's near-cache.ts to Go.
// ──────────────────────────────────────────────────────────────

type nearCacheEntry struct {
	data      []byte
	expiresAt time.Time
}

// NearCache is a lightweight in-process cache with TTL.
// Zero external dependencies — uses sync.Map for concurrent read/write.
type NearCache struct {
	store   sync.Map
	stopCh  chan struct{}
	stopped bool
	mu      sync.Mutex // protects stopped flag
}

// NewNearCache creates a NearCache that sweeps expired entries every sweepInterval.
func NewNearCache(sweepInterval time.Duration) *NearCache {
	if sweepInterval <= 0 {
		sweepInterval = 10 * time.Second
	}
	nc := &NearCache{
		stopCh: make(chan struct{}),
	}
	go nc.sweepLoop(sweepInterval)
	return nc
}

func (c *NearCache) sweepLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			now := time.Now()
			c.store.Range(func(key, value interface{}) bool {
				if entry, ok := value.(*nearCacheEntry); ok && now.After(entry.expiresAt) {
					c.store.Delete(key)
				}
				return true
			})
		case <-c.stopCh:
			return
		}
	}
}

// Get returns the cached bytes or nil on miss / expiry.
func (c *NearCache) Get(key string) []byte {
	val, ok := c.store.Load(key)
	if !ok {
		return nil
	}
	entry := val.(*nearCacheEntry)
	if time.Now().After(entry.expiresAt) {
		c.store.Delete(key)
		return nil
	}
	return entry.data
}

// Set stores bytes with the given TTL.
func (c *NearCache) Set(key string, data []byte, ttl time.Duration) {
	c.store.Store(key, &nearCacheEntry{
		data:      data,
		expiresAt: time.Now().Add(ttl),
	})
}

// Delete removes a single key.
func (c *NearCache) Delete(key string) {
	c.store.Delete(key)
}

// Clear removes all entries.
func (c *NearCache) Clear() {
	c.store.Range(func(key, _ interface{}) bool {
		c.store.Delete(key)
		return true
	})
}

// Size returns the approximate number of entries.
func (c *NearCache) Size() int {
	n := 0
	c.store.Range(func(_, _ interface{}) bool {
		n++
		return true
	})
	return n
}

// Destroy stops the sweep goroutine and clears the cache.
func (c *NearCache) Destroy() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.stopped {
		close(c.stopCh)
		c.stopped = true
	}
	c.Clear()
}
