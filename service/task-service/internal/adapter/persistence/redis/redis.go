package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Config represents Redis configuration
type Config struct {
	Addr           string        `json:"addr"`
	Password       string        `json:"password"`
	DB             int           `json:"db"`
	KeyPrefix      string        `json:"key_prefix"`
	ReadTimeout    time.Duration `json:"read_timeout"`
	WriteTimeout   time.Duration `json:"write_timeout"`
	ConnectTimeout time.Duration `json:"connect_timeout"`
	MaxRetries     int           `json:"max_retries"`
}

// NewClient creates a new Redis client
func NewClient(cfg *Config) (*redis.Client, func(), error) {
	client := redis.NewClient(&redis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		DialTimeout:  cfg.ConnectTimeout,
		MaxRetries:   cfg.MaxRetries,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ConnectTimeout)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	cleanup := func() {
		_ = client.Close()
	}

	return client, cleanup, nil
}
