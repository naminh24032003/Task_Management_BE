package server

import (
	"context"
	"encoding/json"
	"time"

	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	kratosHttp "github.com/go-kratos/kratos/v2/transport/http"
	"github.com/google/wire"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"notification-service/internal/app/consumer"
)

// ProviderSet is server providers.
var ProviderSet = wire.NewSet(NewHTTPServer)

// ServerConfig represents server configuration
type ServerConfig struct {
	HTTP HTTPConfig `json:"http"`
}

type HTTPConfig struct {
	Addr    string `json:"addr"`
	Timeout string `json:"timeout"`
}

// NewHTTPServer creates a new HTTP server
func NewHTTPServer(
	c config.Config,
	logger log.Logger,
	consumerBootstrap *consumer.KafkaConsumerBootstrap,
) *kratosHttp.Server {
	helper := log.NewHelper(log.With(logger, "module", "server/http"))

	var cfg struct {
		Server ServerConfig `json:"server"`
	}
	if err := c.Scan(&cfg); err != nil {
		helper.Errorf("Failed to scan server config: %v", err)
	}

	addr := cfg.Server.HTTP.Addr
	if addr == "" {
		helper.Warn("HTTP address not configured (HTTP_ADDR env var), using default 0.0.0.0:9093")
		addr = "0.0.0.0:9093"
	}

	timeout := 10 * time.Second
	if cfg.Server.HTTP.Timeout != "" {
		if d, err := time.ParseDuration(cfg.Server.HTTP.Timeout); err == nil {
			timeout = d
		}
	}

	opts := []kratosHttp.ServerOption{
		kratosHttp.Address(addr),
		kratosHttp.Timeout(timeout),
		kratosHttp.Middleware(
			recovery.Recovery(),
		),
	}

	srv := kratosHttp.NewServer(opts...)

	// Register routes
	registerRoutes(srv, consumerBootstrap, helper)

	helper.Infof("HTTP server listening on %s", addr)
	return srv
}

func registerRoutes(srv *kratosHttp.Server, bootstrap *consumer.KafkaConsumerBootstrap, logger *log.Helper) {
	router := srv.Route("/")

	// Health check endpoint
	router.GET("/health", func(ctx kratosHttp.Context) error {
		response := map[string]interface{}{
			"status":    "healthy",
			"service":   "notification-service",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		}
		ctx.Response().Header().Set("Content-Type", "application/json")
		return json.NewEncoder(ctx.Response()).Encode(response)
	})

	// Readiness check endpoint
	router.GET("/ready", func(ctx kratosHttp.Context) error {
		response := map[string]interface{}{
			"status":    "ready",
			"service":   "notification-service",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		}
		ctx.Response().Header().Set("Content-Type", "application/json")
		return json.NewEncoder(ctx.Response()).Encode(response)
	})

	// Metrics endpoint for Prometheus
	router.GET("/metrics", func(ctx kratosHttp.Context) error {
		promhttp.Handler().ServeHTTP(ctx.Response(), ctx.Request())
		return nil
	})

	// Start Kafka consumer when server starts
	go func() {
		logger.Info("Starting Kafka consumer...")
		ctx := context.Background()
		if err := bootstrap.Start(ctx); err != nil {
			if ctx.Err() == nil {
				logger.Errorf("Kafka consumer error: %v", err)
			}
		}
	}()
}
