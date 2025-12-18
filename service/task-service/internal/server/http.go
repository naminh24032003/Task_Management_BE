package server

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/http"
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
		),
	}

	// Default configuration
	opts = append(opts, http.Address(":8000"))

	srv := http.NewServer(opts...)

	// Register routes here
	// Example: taskv1.RegisterTaskServiceHTTPServer(srv, taskService)

	return srv
}
