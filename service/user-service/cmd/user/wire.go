//go:build wireinject
// +build wireinject

package main

import (
	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"

	"user-service/internal/server"
)

// wireApp init kratos application.
func wireApp(c config.Config, logger log.Logger) (*kratos.App, func(), error) {
	panic(wire.Build(
		server.ProviderSet,
		newApp,
	))
}
