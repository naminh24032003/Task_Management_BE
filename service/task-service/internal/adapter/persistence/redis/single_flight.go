package redis

import (
	"sync"
	"time"
)

// ──────────────────────────────────────────────────────────────
// SingleFlight — dedup concurrent requests for the same key.
// Ported from user-service's single-flight.ts to Go.
//
// Go's stdlib has x/sync/singleflight but it doesn't have
// stuck-request protection (maxAge). This version does.
// ──────────────────────────────────────────────────────────────

type flight struct {
	wg        sync.WaitGroup
	result    []byte
	err       error
	createdAt time.Time
}

// SingleFlight deduplicates concurrent calls for the same key.
// If a request for key K is already in-flight, new callers share
// the same result instead of making redundant Redis/DB calls.
type SingleFlight struct {
	mu      sync.Mutex
	flights map[string]*flight
	maxAge  time.Duration // max time a flight can stay in-flight before being considered stuck
}

// NewSingleFlight creates a SingleFlight with a stuck-request timeout.
func NewSingleFlight(maxAge time.Duration) *SingleFlight {
	if maxAge <= 0 {
		maxAge = 30 * time.Second
	}
	return &SingleFlight{
		flights: make(map[string]*flight),
		maxAge:  maxAge,
	}
}

// Do executes fn for the given key, deduplicating concurrent callers.
// If another goroutine is already executing fn for the same key, this
// caller blocks and receives the same (result, error).
//
// Stuck request protection: if the in-flight request was started more
// than maxAge ago, it is considered stuck and a new request is initiated.
func (sf *SingleFlight) Do(key string, fn func() ([]byte, error)) ([]byte, error) {
	sf.mu.Lock()
	if f, ok := sf.flights[key]; ok {
		// Check if the existing flight is stuck
		if time.Since(f.createdAt) < sf.maxAge {
			sf.mu.Unlock()
			f.wg.Wait()
			return f.result, f.err
		}
		// Stuck → fall through and start a new flight
		delete(sf.flights, key)
	}

	f := &flight{createdAt: time.Now()}
	f.wg.Add(1)
	sf.flights[key] = f
	sf.mu.Unlock()

	// Execute the actual work
	f.result, f.err = fn()
	f.wg.Done()

	// Cleanup: remove only if we are still the current flight for this key
	sf.mu.Lock()
	if sf.flights[key] == f {
		delete(sf.flights, key)
	}
	sf.mu.Unlock()

	return f.result, f.err
}

// InFlightCount returns the number of keys currently in-flight.
func (sf *SingleFlight) InFlightCount() int {
	sf.mu.Lock()
	defer sf.mu.Unlock()
	return len(sf.flights)
}
