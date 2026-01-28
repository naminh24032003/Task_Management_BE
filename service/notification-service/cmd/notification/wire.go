//go:build wireinject
// +build wireinject

package main

import (
	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"

	"notification-service/internal/data"
	"notification-service/internal/server"
)

// wireApp initializes the application with wire
func wireApp(c config.Config, logger log.Logger) (*kratos.App, func(), error) {
	wire.Build(
		data.ProviderSet,
		server.ProviderSet,
		newApp,
	)
	return nil, nil, nil
}
