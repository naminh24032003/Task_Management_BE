package ports

import (
	"context"
	"time"
)

// IdempotencyStore defines the interface for idempotency checking
type IdempotencyStore interface {
	// Check checks if an event has been processed before
	// Returns true if the event has already been processed
	Check(ctx context.Context, eventID string) (bool, error)

	// Mark marks an event as processed with a TTL
	Mark(ctx context.Context, eventID string, ttl time.Duration) error

	// Remove removes an event from the store
	Remove(ctx context.Context, eventID string) error

	// CheckAndMark atomically checks and marks an event as processed
	// Returns true if the event was already processed
	CheckAndMark(ctx context.Context, eventID string, ttl time.Duration) (bool, error)
}
