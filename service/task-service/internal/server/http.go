package server

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/http"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/task-management/go-shared/middleware"
)

// HTTPServerConfig holds HTTP server configuration
type HTTPServerConfig struct {
	Addr    string
	Timeout string
}

// NewHTTPServer creates an HTTP server
func NewHTTPServer(
	logger log.Logger,
) *http.Server {
	var opts = []http.ServerOption{
		http.Middleware(
			recovery.Recovery(),
			middleware.SecurityHeadersMiddleware(), // Enterprise cache-control + security headers
		),
	}

	// Use port 9091 for metrics (different from gRPC 50052)
	opts = append(opts, http.Address(":9091"))

	srv := http.NewServer(opts...)

	// Register Prometheus metrics endpoint
	// Wrap with WithSecurityHeaders because srv.Handle() bypasses Kratos middleware.
	srv.Handle("/metrics", middleware.WithSecurityHeaders(promhttp.Handler()))

	// Register routes here
	// Example: taskv1.RegisterTaskServiceHTTPServer(srv, taskService)

	return srv
}
