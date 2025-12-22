package server

import (
	"github.com/google/wire"

	usergrpc "user-service/internal/transport/grpc"
)

// ProviderSet is server providers.
var ProviderSet = wire.NewSet(
	usergrpc.NewUserService,
	NewGRPCServer,
	NewHTTPServer,
)
