package server

import (
	"github.com/google/wire"

	"task-service/internal/data"
	taskgrpc "task-service/internal/transport/grpc"
)

// ProviderSet is server providers.
var ProviderSet = wire.NewSet(
	data.ProviderSet,
	taskgrpc.NewTaskService,
	NewGRPCServer,
	NewHTTPServer,
)
