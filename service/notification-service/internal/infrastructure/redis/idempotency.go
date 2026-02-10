package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	idempotencyKeyPrefix = "notification:idempotency:"
	defaultTTL           = 24 * time.Hour
)

// IdempotencyStore implements idempotency checking using Redis Cluster
type IdempotencyStore struct {
	client *redis.ClusterClient
}

// RedisConfig contains Redis Cluster connection configuration
type RedisConfig struct {
	Addrs    []string
	Password string
}

// NewIdempotencyStore creates a new IdempotencyStore
func NewIdempotencyStore(client *redis.ClusterClient) *IdempotencyStore {
	return &IdempotencyStore{
		client: client,
	}
}

// NewRedisClient creates a new Redis Cluster client
func NewRedisClient(config RedisConfig) (*redis.ClusterClient, error) {
	client := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs:    config.Addrs,
		Password: config.Password,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis Cluster: %w", err)
	}

	return client, nil
}

// Check checks if an event has been processed before
func (s *IdempotencyStore) Check(ctx context.Context, eventID string) (bool, error) {
	key := idempotencyKeyPrefix + eventID
	exists, err := s.client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check idempotency: %w", err)
	}
	return exists > 0, nil
}

// Mark marks an event as processed with a TTL
func (s *IdempotencyStore) Mark(ctx context.Context, eventID string, ttl time.Duration) error {
	key := idempotencyKeyPrefix + eventID
	if ttl == 0 {
		ttl = defaultTTL
	}

	err := s.client.Set(ctx, key, "processed", ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to mark event as processed: %w", err)
	}
	return nil
}

// Remove removes an event from the store
func (s *IdempotencyStore) Remove(ctx context.Context, eventID string) error {
	key := idempotencyKeyPrefix + eventID
	err := s.client.Del(ctx, key).Err()
	if err != nil {
		return fmt.Errorf("failed to remove idempotency key: %w", err)
	}
	return nil
}

// CheckAndMark atomically checks and marks an event as processed
// Returns true if the event was already processed
func (s *IdempotencyStore) CheckAndMark(ctx context.Context, eventID string, ttl time.Duration) (bool, error) {
	key := idempotencyKeyPrefix + eventID
	if ttl == 0 {
		ttl = defaultTTL
	}

	// Use SetNX for atomic check-and-set
	wasSet, err := s.client.SetNX(ctx, key, "processed", ttl).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check and mark event: %w", err)
	}

	// wasSet is true if the key was set (event was NOT processed before)
	// Return the inverse: true if already processed
	return !wasSet, nil
}
