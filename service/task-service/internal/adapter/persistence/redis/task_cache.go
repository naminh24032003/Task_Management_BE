package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"task-service/internal/application/port"
	"task-service/internal/domain/aggregate"
	"task-service/internal/pkg/resilience"
)

// ──────────────────────────────────────────────────────────────
// Lua scripts – every operation is a single EVAL → fully atomic
// ──────────────────────────────────────────────────────────────

// luaGetOrSet: GET from cache. Returns value on hit, empty string on miss.
const luaGetOrSet = `
local val = redis.call('GET', KEYS[1])
if val then
  return val
end
return ''
`

// luaSetWithTTL: atomic SET + PEXPIRE in one round-trip.
const luaSetWithTTL = `
redis.call('SET', KEYS[1], ARGV[1])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
`

// luaInvalidate: DEL a key, returns number of keys removed.
const luaInvalidate = `return redis.call('DEL', KEYS[1])`

// luaAcquireLock: Redlock-style SET NX PX.
// Returns "OK" if lock acquired, empty string otherwise.
const luaAcquireLock = `
return redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2])
`

// luaReleaseLock: CAS release – only deletes if the value matches the token.
// Prevents releasing someone else's lock.
const luaReleaseLock = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`

// luaIdempotencyCheck: Atomic check-and-set.
//
//	KEYS[1] = idempotency key
//	ARGV[1] = placeholder value ("__processing__")
//	ARGV[2] = TTL in milliseconds
//
// Returns:
//
//	[0, ""]              → new request, placeholder set
//	[1, "<result>"]      → already processed / in progress
const luaIdempotencyCheck = `
local val = redis.call('GET', KEYS[1])
if val then
  return {1, val}
end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
return {0, ''}
`

// luaIdempotencySetResult: overwrite placeholder with final result, keep TTL.
const luaIdempotencySetResult = `
redis.call('SET', KEYS[1], ARGV[1])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
`

// luaHIncrBy: atomic HINCRBY on a hash field. Returns new value.
// Also sets expiry on the hash if it's the first field.
const luaHIncrBy = `
local newVal = redis.call('HINCRBY', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], 86400)
return newVal
`

// ──────────────────────────────────────────────────────────────
// TaskCacheRedis implements port.TaskCache using 3-tier cache:
//   L1  Near Cache  (in-process sync.Map, ~1µs)
//    ↓ miss
//   SingleFlight    (dedup concurrent requests)
//    ↓ wraps
//   L2  Redis Lua   (atomic EVAL, ~1ms)
//    ↓ miss → caller falls through to DB
//
// Same pattern as user-service's MultiTierCacheService.
// ──────────────────────────────────────────────────────────────

const (
	nearCacheTTL  = 5 * time.Minute  // L1 TTL (shorter than L2 — fast local invalidation)
	redisCacheTTL = 10 * time.Minute // L2 TTL
)

type TaskCacheRedis struct {
	client       *redis.ClusterClient
	keyPrefix    string
	nearCache    *NearCache
	singleFlight *SingleFlight
	cb           *resilience.CircuitBreaker // protects Redis calls
	logger       *log.Helper
}

// NewTaskCache creates a new 3-tier TaskCache with circuit breaker on Redis.
func NewTaskCache(client *redis.ClusterClient, keyPrefix string, logger log.Logger) *TaskCacheRedis {
	if keyPrefix == "" {
		keyPrefix = "task:"
	}
	return &TaskCacheRedis{
		client:       client,
		keyPrefix:    keyPrefix,
		nearCache:    NewNearCache(10 * time.Second),
		singleFlight: NewSingleFlight(30 * time.Second),
		cb: resilience.NewCircuitBreaker("redis-cache", logger,
			resilience.WithFailureThreshold(5),
			resilience.WithResetTimeout(30*time.Second),
		),
		logger: log.NewHelper(log.With(logger, "component", "task-cache")),
	}
}

// ── helpers ──────────────────────────────────────────────────

func (r *TaskCacheRedis) cacheKey(tenantID, taskID string) string {
	return fmt.Sprintf("%scache:{%s}:%s", r.keyPrefix, tenantID, taskID)
}

func (r *TaskCacheRedis) lockKey(resource string) string {
	return fmt.Sprintf("%slock:{%s}", r.keyPrefix, resource)
}

func (r *TaskCacheRedis) idempotencyKey(key string) string {
	return fmt.Sprintf("%sidem:{%s}", r.keyPrefix, key)
}

func (r *TaskCacheRedis) counterKey(tenantID, scope string) string {
	return fmt.Sprintf("%scounter:{%s}:%s", r.keyPrefix, tenantID, scope)
}

// ── Cache (L1 NearCache → L2 Redis Lua) ─────────────────────
// SingleFlight is exposed via SingleFlightDo() for callers to
// wrap the DB call (L3), not the Redis call.

func (r *TaskCacheRedis) GetTask(ctx context.Context, tenantID, taskID string) (*aggregate.Task, error) {
	key := r.cacheKey(tenantID, taskID)

	// ── L1: Near Cache (~1µs) ──────────────────────────
	if data := r.nearCache.Get(key); data != nil {
		var task aggregate.Task
		if err := json.Unmarshal(data, &task); err == nil {
			return &task, nil
		}
		r.nearCache.Delete(key) // corrupted → evict
	}

	// ── L2: Redis Lua (EVAL GET, ~1ms) — circuit breaker protected ──
	var task *aggregate.Task
	err := r.cb.Exec(func() error {
		result, err := r.client.Eval(ctx, luaGetOrSet, []string{key}).Text()
		if err != nil && err != redis.Nil {
			return fmt.Errorf("redis GetTask lua error: %w", err)
		}
		if result == "" {
			return nil // L2 miss
		}
		var t aggregate.Task
		if err := json.Unmarshal([]byte(result), &t); err != nil {
			_ = r.client.Del(ctx, key) // corrupted → evict
			return nil
		}
		r.nearCache.Set(key, []byte(result), nearCacheTTL)
		task = &t
		return nil
	})
	if err != nil {
		if errors.Is(err, resilience.ErrCircuitOpen) {
			r.logger.Warnf("Redis circuit OPEN, skipping L2 cache read for %s", key)
			return nil, nil // degrade: cache miss → SingleFlight → DB
		}
		return nil, err
	}
	return task, nil
}

// SingleFlightDo deduplicates concurrent calls for the same key.
// Callers use this to wrap the DB fetch so that N goroutines
// hitting the same cache miss only produce 1 DB query.
func (r *TaskCacheRedis) SingleFlightDo(key string, fn func() (*aggregate.Task, error)) (*aggregate.Task, error) {
	data, err := r.singleFlight.Do(key, func() ([]byte, error) {
		task, err := fn()
		if err != nil {
			return nil, err
		}
		if task == nil {
			return nil, nil
		}
		bytes, err := json.Marshal(task)
		if err != nil {
			return nil, err
		}
		return bytes, nil
	})
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, nil
	}
	var task aggregate.Task
	if err := json.Unmarshal(data, &task); err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *TaskCacheRedis) SetTask(ctx context.Context, tenantID, taskID string, task *aggregate.Task, ttl time.Duration) error {
	bytes, err := json.Marshal(task)
	if err != nil {
		return fmt.Errorf("marshal task: %w", err)
	}
	key := r.cacheKey(tenantID, taskID)

	// L1: near cache (always works — in-process)
	r.nearCache.Set(key, bytes, nearCacheTTL)

	// L2: Redis Lua (SET + PEXPIRE atomic) — circuit breaker protected
	err = r.cb.Exec(func() error {
		ttlMs := ttl.Milliseconds()
		_, err := r.client.Eval(ctx, luaSetWithTTL, []string{key}, string(bytes), ttlMs).Result()
		if err != nil {
			return fmt.Errorf("redis SetTask lua error: %w", err)
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, resilience.ErrCircuitOpen) {
			r.logger.Warnf("Redis circuit OPEN, skipping L2 cache write for %s", key)
			return nil // degrade: L1 only, skip L2
		}
		return err
	}
	return nil
}

func (r *TaskCacheRedis) InvalidateTask(ctx context.Context, tenantID, taskID string) error {
	key := r.cacheKey(tenantID, taskID)

	// L1: near cache — immediate eviction (always works)
	r.nearCache.Delete(key)

	// L2: Redis Lua (DEL) — circuit breaker protected
	err := r.cb.Exec(func() error {
		_, err := r.client.Eval(ctx, luaInvalidate, []string{key}).Result()
		if err != nil && err != redis.Nil {
			return fmt.Errorf("redis InvalidateTask lua error: %w", err)
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, resilience.ErrCircuitOpen) {
			r.logger.Warnf("Redis circuit OPEN, skipping L2 cache invalidation for %s", key)
			return nil // degrade: L1 evicted at least
		}
		return err
	}
	return nil
}

// ── Distributed Lock ─────────────────────────────────────────

func (r *TaskCacheRedis) AcquireLock(ctx context.Context, resource string, ttl time.Duration) (string, error) {
	token := uuid.New().String()
	key := r.lockKey(resource)
	ttlMs := ttl.Milliseconds()

	var acquired bool
	err := r.cb.Exec(func() error {
		result, err := r.client.Eval(ctx, luaAcquireLock, []string{key}, token, ttlMs).Text()
		if err != nil && err != redis.Nil {
			return fmt.Errorf("redis AcquireLock lua error: %w", err)
		}
		acquired = result == "OK"
		return nil
	})
	if err != nil {
		if errors.Is(err, resilience.ErrCircuitOpen) {
			r.logger.Warnf("Redis circuit OPEN, lock not available for %s (degraded)", resource)
			return "", nil // degrade: lock not acquired, caller proceeds without lock
		}
		return "", err
	}
	if acquired {
		return token, nil
	}
	return "", nil // lock not acquired
}

func (r *TaskCacheRedis) ReleaseLock(ctx context.Context, resource string, token string) error {
	key := r.lockKey(resource)
	err := r.cb.Exec(func() error {
		_, err := r.client.Eval(ctx, luaReleaseLock, []string{key}, token).Result()
		if err != nil && err != redis.Nil {
			return fmt.Errorf("redis ReleaseLock lua error: %w", err)
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, resilience.ErrCircuitOpen) {
			r.logger.Warnf("Redis circuit OPEN, skipping lock release for %s (will auto-expire)", resource)
			return nil // degrade: lock will auto-expire via TTL
		}
		return err
	}
	return nil
}

// ── Idempotency ──────────────────────────────────────────────

const idempotencyPlaceholder = "__processing__"

func (r *TaskCacheRedis) CheckIdempotency(ctx context.Context, key string, ttl time.Duration) (string, bool, error) {
	rKey := r.idempotencyKey(key)
	ttlMs := ttl.Milliseconds()

	var resultVal string
	var exists bool

	err := r.cb.Exec(func() error {
		result, err := r.client.Eval(ctx, luaIdempotencyCheck, []string{rKey}, idempotencyPlaceholder, ttlMs).Slice()
		if err != nil {
			return fmt.Errorf("redis CheckIdempotency lua error: %w", err)
		}
		flag, _ := toInt64(result[0])
		if flag == 1 {
			resultVal, _ = toString(result[1])
			exists = true
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, resilience.ErrCircuitOpen) {
			r.logger.Warnf("Redis circuit OPEN, skipping idempotency check for %s (degraded)", key)
			return "", false, nil // degrade: proceed without idempotency guard
		}
		return "", false, err
	}
	return resultVal, exists, nil
}

func (r *TaskCacheRedis) SetIdempotencyResult(ctx context.Context, key string, resultVal string, ttl time.Duration) error {
	rKey := r.idempotencyKey(key)
	ttlMs := ttl.Milliseconds()
	err := r.cb.Exec(func() error {
		_, err := r.client.Eval(ctx, luaIdempotencySetResult, []string{rKey}, resultVal, ttlMs).Result()
		if err != nil {
			return fmt.Errorf("redis SetIdempotencyResult lua error: %w", err)
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, resilience.ErrCircuitOpen) {
			r.logger.Warnf("Redis circuit OPEN, skipping idempotency result set for %s", key)
			return nil // degrade: skip
		}
		return err
	}
	return nil
}

// ── Atomic Counters ──────────────────────────────────────────

func (r *TaskCacheRedis) IncrementProjectTaskCount(ctx context.Context, tenantID, projectID string, delta int64) (int64, error) {
	key := r.counterKey(tenantID, "project:"+projectID)
	var val int64
	err := r.cb.Exec(func() error {
		v, err := r.client.Eval(ctx, luaHIncrBy, []string{key}, "task_count", delta).Int64()
		if err != nil {
			return fmt.Errorf("redis IncrementProjectTaskCount lua error: %w", err)
		}
		val = v
		return nil
	})
	if err != nil {
		if errors.Is(err, resilience.ErrCircuitOpen) {
			r.logger.Warnf("Redis circuit OPEN, skipping project counter for %s", key)
			return 0, nil // degrade: counter unavailable
		}
		return 0, err
	}
	return val, nil
}

func (r *TaskCacheRedis) IncrementUserAssignedCount(ctx context.Context, tenantID, userID string, delta int64) (int64, error) {
	key := r.counterKey(tenantID, "user:"+userID)
	var val int64
	err := r.cb.Exec(func() error {
		v, err := r.client.Eval(ctx, luaHIncrBy, []string{key}, "assigned_count", delta).Int64()
		if err != nil {
			return fmt.Errorf("redis IncrementUserAssignedCount lua error: %w", err)
		}
		val = v
		return nil
	})
	if err != nil {
		if errors.Is(err, resilience.ErrCircuitOpen) {
			r.logger.Warnf("Redis circuit OPEN, skipping user counter for %s", key)
			return 0, nil // degrade: counter unavailable
		}
		return 0, err
	}
	return val, nil
}

// ── Lifecycle & Observability ────────────────────────────────

// Destroy stops the near-cache sweep goroutine and clears L1.
func (r *TaskCacheRedis) Destroy() {
	r.nearCache.Destroy()
}

// Stats returns cache observability info.
func (r *TaskCacheRedis) Stats() port.CacheStats {
	return port.CacheStats{
		NearCacheSize: r.nearCache.Size(),
		InFlightCount: r.singleFlight.InFlightCount(),
	}
}

// ── type conversion helpers for Lua results ──────────────────

func toInt64(v interface{}) (int64, bool) {
	switch val := v.(type) {
	case int64:
		return val, true
	case int:
		return int64(val), true
	case string:
		return 0, false
	}
	return 0, false
}

func toString(v interface{}) (string, bool) {
	switch val := v.(type) {
	case string:
		return val, true
	case []byte:
		return string(val), true
	}
	return "", false
}
