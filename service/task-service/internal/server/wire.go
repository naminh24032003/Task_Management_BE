package server

import (
	"github.com/google/wire"

	taskgrpc "task-service/internal/transport/grpc"
)

// ProviderSet is server providers.
var ProviderSet = wire.NewSet(
	taskgrpc.NewTaskService,
	NewGRPCServer,
	NewHTTPServer,
)
