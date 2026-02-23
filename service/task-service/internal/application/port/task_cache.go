package port

import (
	"context"
	"time"

	"task-service/internal/domain/aggregate"
)

// TaskCache defines the port for caching, distributed locking, and idempotency.
// All implementations MUST use atomic operations (e.g. Redis Lua scripts)
// to avoid race conditions in distributed environments.
type TaskCache interface {
	// ── Cache ─────────────────────────────────────────────────
	// GetTask returns a cached task or nil if cache miss (L1 NearCache → L2 Redis Lua).
	GetTask(ctx context.Context, tenantID, taskID string) (*aggregate.Task, error)
	// SetTask caches a task with TTL. Writes to both L1 and L2.
	SetTask(ctx context.Context, tenantID, taskID string, task *aggregate.Task, ttl time.Duration) error
	// InvalidateTask removes a single task from both L1 and L2.
	InvalidateTask(ctx context.Context, tenantID, taskID string) error

	// ── SingleFlight (dedup DB calls) ────────────────────────
	// SingleFlightDo deduplicates concurrent calls for the same key.
	// Use this to wrap DB fetches so that N goroutines hitting the
	// same cache miss only produce 1 DB query.
	SingleFlightDo(key string, fn func() (*aggregate.Task, error)) (*aggregate.Task, error)

	// ── Distributed Lock ──────────────────────────────────────
	// AcquireLock tries to acquire a distributed lock. Returns a token on success, "" on failure.
	AcquireLock(ctx context.Context, resource string, ttl time.Duration) (token string, err error)
	// ReleaseLock releases a distributed lock only if the token matches (atomic CAS).
	ReleaseLock(ctx context.Context, resource string, token string) error

	// ── Idempotency ───────────────────────────────────────────
	// CheckIdempotency atomically checks if a request has been processed.
	// Returns (existingResult, true) if already processed, ("", false) if new.
	// On new request, atomically sets a placeholder with TTL.
	CheckIdempotency(ctx context.Context, key string, ttl time.Duration) (existingResult string, alreadyProcessed bool, err error)
	// SetIdempotencyResult sets the final result for an idempotency key (after processing).
	SetIdempotencyResult(ctx context.Context, key string, result string, ttl time.Duration) error

	// ── Atomic Counters ───────────────────────────────────────
	// IncrementProjectTaskCount atomically increments the task count for a project.
	IncrementProjectTaskCount(ctx context.Context, tenantID, projectID string, delta int64) (int64, error)
	// IncrementUserAssignedCount atomically increments the assigned-task count for a user.
	IncrementUserAssignedCount(ctx context.Context, tenantID, userID string, delta int64) (int64, error)

	// ── Lifecycle ─────────────────────────────────────────────
	// Destroy cleans up resources (near-cache sweep goroutine, etc.).
	Destroy()

	// ── Observability ─────────────────────────────────────────
	// Stats returns cache statistics (near cache size, singleflight in-flight count).
	Stats() CacheStats
}

// CacheStats holds cache observability info.
type CacheStats struct {
	NearCacheSize int
	InFlightCount int
}
