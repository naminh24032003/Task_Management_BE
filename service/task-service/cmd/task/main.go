package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/task-management/go-shared/logger"
	"github.com/task-management/go-shared/tracing"

	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/config/env"
	"github.com/go-kratos/kratos/v2/config/file"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/transport/grpc"
	"github.com/go-kratos/kratos/v2/transport/http"
	"github.com/joho/godotenv"
)

// go build -ldflags "-X main.Version=x.y.z"
var (
	// Name is the name of the compiled software.
	Name string = "task-service"
	// Version is the version of the compiled software.
	Version string
	// flagconf is the config flag.
	flagconf string

	id, _ = os.Hostname()
)

func init() {
	flag.StringVar(&flagconf, "conf", "../../configs", "config path, eg: -conf config.yaml")
}

func newApp(logger log.Logger, gs *grpc.Server, hs *http.Server) *kratos.App {
	return kratos.New(
		kratos.ID(id),
		kratos.Name(Name),
		kratos.Version(Version),
		kratos.Metadata(map[string]string{}),
		kratos.Logger(logger),
		kratos.Server(
			gs,
			hs,
		),
	)
}

func main() {
	flag.Parse()

	// Load .env file (optional - won't fail if not exists)
	envFile := filepath.Join(filepath.Dir(flagconf), "..", ".env")
	if err := godotenv.Load(envFile); err != nil {
		// Try loading from current directory
		_ = godotenv.Load()
	}

	// Logger with colors
	logger := log.With(logger.New(),
		"ts", log.DefaultTimestamp,
		"caller", log.DefaultCaller,
		"service.id", id,
		"service.name", Name,
		"service.version", Version,
	)

	c := config.New(
		config.WithSource(
			file.NewSource(flagconf),
			env.NewSource(),
		),
	)
	defer c.Close()

	if err := c.Load(); err != nil {
		panic(err)
	}

	// Initialize OpenTelemetry tracing BEFORE wireApp so MongoDB picks up global tracer
	tracingShutdown, err := tracing.InitTracing(Name, Version)
	if err != nil {
		fmt.Printf("Failed to initialize tracing: %v\n", err)
		// Continue without tracing - non-fatal
	} else {
		defer tracingShutdown()
	}

	// Initialize application with wire
	app, cleanup, err := wireApp(c, logger)
	if err != nil {
		panic(err)
	}
	defer cleanup()

	// Start and wait for stop signal
	if err := app.Run(); err != nil {
		panic(err)
	}
}
