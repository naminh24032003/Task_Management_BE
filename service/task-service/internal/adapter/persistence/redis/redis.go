package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Config represents Redis Cluster configuration
type Config struct {
	Addrs          []string      `json:"addrs"`
	Password       string        `json:"password"`
	KeyPrefix      string        `json:"key_prefix"`
	ReadTimeout    time.Duration `json:"read_timeout"`
	WriteTimeout   time.Duration `json:"write_timeout"`
	ConnectTimeout time.Duration `json:"connect_timeout"`
	MaxRetries     int           `json:"max_retries"`
}

// NewClient creates a new Redis Cluster client
func NewClient(cfg *Config) (*redis.ClusterClient, func(), error) {
	client := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs:        cfg.Addrs,
		Password:     cfg.Password,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		DialTimeout:  cfg.ConnectTimeout,
		MaxRetries:   cfg.MaxRetries,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ConnectTimeout)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, nil, fmt.Errorf("failed to connect to Redis Cluster: %w", err)
	}

	cleanup := func() {
		_ = client.Close()
	}

	return client, cleanup, nil
}
