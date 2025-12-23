#!/bin/bash

# =============================================================================
# Go Kratos Service Generator
# Based on task-service architecture (Clean Architecture + DDD + CQRS)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Show usage
usage() {
    echo "Usage: $0 <service-name> [options]"
    echo ""
    echo "Options:"
    echo "  -d, --directory    Target directory (default: ./service)"
    echo "  -m, --module       Go module name (default: <service-name>)"
    echo "  -p, --port-http    HTTP port (default: 8000)"
    echo "  -g, --port-grpc    gRPC port (default: 9000)"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 order-service"
    echo "  $0 payment-service -d ./services -m github.com/myorg/payment-service"
    exit 1
}

# Default values
SERVICE_NAME=""
TARGET_DIR="./service"
MODULE_NAME=""
HTTP_PORT="8000"
GRPC_PORT="9000"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--directory)
            TARGET_DIR="$2"
            shift 2
            ;;
        -m|--module)
            MODULE_NAME="$2"
            shift 2
            ;;
        -p|--port-http)
            HTTP_PORT="$2"
            shift 2
            ;;
        -g|--port-grpc)
            GRPC_PORT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [[ -z "$SERVICE_NAME" ]]; then
                SERVICE_NAME="$1"
            fi
            shift
            ;;
    esac
done

# Validate service name
if [[ -z "$SERVICE_NAME" ]]; then
    print_error "Service name is required!"
    usage
fi

# Set default module name if not provided
if [[ -z "$MODULE_NAME" ]]; then
    MODULE_NAME="$SERVICE_NAME"
fi

# Convert service name for use in code (e.g., order-service -> order, OrderService)
SERVICE_SHORT=$(echo "$SERVICE_NAME" | sed 's/-service$//')
SERVICE_PASCAL=$(echo "$SERVICE_SHORT" | sed -r 's/(^|-)(\w)/\U\2/g')
SERVICE_LOWER=$(echo "$SERVICE_SHORT" | tr '[:upper:]' '[:lower:]')

SERVICE_PATH="$TARGET_DIR/$SERVICE_NAME"

print_info "Creating Go Kratos service: $SERVICE_NAME"
print_info "Target directory: $SERVICE_PATH"
print_info "Module name: $MODULE_NAME"

# Check if directory exists
if [[ -d "$SERVICE_PATH" ]]; then
    print_error "Directory $SERVICE_PATH already exists!"
    exit 1
fi

# Create directory structure
print_info "Creating directory structure..."

mkdir -p "$SERVICE_PATH"/{api/$SERVICE_LOWER/v1,cmd/$SERVICE_LOWER,configs}
mkdir -p "$SERVICE_PATH"/internal/{adapter/{external,messaging/kafka,persistence/postgres}}
mkdir -p "$SERVICE_PATH"/internal/{application/{command,event_handler,handler,query,saga}}
mkdir -p "$SERVICE_PATH"/internal/{domain/{aggregate,entity,event,repository,service,valueobject}}
mkdir -p "$SERVICE_PATH"/internal/{pkg/logger,server,transport/{consumer,grpc,http}}
mkdir -p "$SERVICE_PATH"/third_party/google/api

print_success "Directory structure created!"

# =============================================================================
# Create go.mod
# =============================================================================
print_info "Creating go.mod..."
cat > "$SERVICE_PATH/go.mod" << EOF
module $MODULE_NAME

go 1.23.0

require (
	github.com/go-kratos/kratos/v2 v2.8.0
	github.com/google/uuid v1.6.0
	github.com/google/wire v0.6.0
	github.com/lib/pq v1.10.9
	github.com/segmentio/kafka-go v0.4.49
	google.golang.org/grpc v1.65.0
	google.golang.org/protobuf v1.34.1
)
EOF

# =============================================================================
# Create Makefile
# =============================================================================
print_info "Creating Makefile..."
cat > "$SERVICE_PATH/Makefile" << 'EOF'
GOHOSTOS:=$(shell go env GOHOSTOS)
GOPATH:=$(shell go env GOPATH)
VERSION=$(shell git describe --tags --always)

ifeq ($(GOHOSTOS), windows)
	Git_Bash=$(subst \,/,$(subst cmd\,bin\bash.exe,$(dir $(shell where git))))
	INTERNAL_PROTO_FILES=$(shell $(Git_Bash) -c "find internal -name *.proto")
	API_PROTO_FILES=$(shell $(Git_Bash) -c "find api -name *.proto")
else
	INTERNAL_PROTO_FILES=$(shell find internal -name *.proto)
	API_PROTO_FILES=$(shell find api -name *.proto)
endif

.PHONY: init
init:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/go-kratos/kratos/cmd/kratos/v2@latest
	go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@latest
	go install github.com/google/gnostic/cmd/protoc-gen-openapi@latest
	go install github.com/google/wire/cmd/wire@latest

.PHONY: config
config:
	protoc --proto_path=./internal \
	       --proto_path=./third_party \
	       --go_out=paths=source_relative:./internal \
	       $(INTERNAL_PROTO_FILES)

.PHONY: api
api:
	protoc --proto_path=./api \
	       --proto_path=./third_party \
	       --go_out=paths=source_relative:./api \
	       --go-http_out=paths=source_relative:./api \
	       --go-grpc_out=paths=source_relative:./api \
	       --openapi_out=fq_schema_naming=true,default_response=false:. \
	       $(API_PROTO_FILES)

.PHONY: build
build:
	mkdir -p bin/ && go build -ldflags "-X main.Version=$(VERSION)" -o ./bin/ ./...

.PHONY: generate
generate:
	go mod tidy
	go generate ./...

.PHONY: wire
wire:
	cd cmd/SERVICE_LOWER && wire

.PHONY: test
test:
	go test -v ./...

.PHONY: run
run:
	go run ./cmd/SERVICE_LOWER -conf ./configs

.PHONY: docker
docker:
	docker build -t SERVICE_NAME:$(VERSION) .

.PHONY: clean
clean:
	rm -rf bin/
	rm -rf ./api/**/*.pb.go

.PHONY: all
all: api generate build

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  init     - Install required tools"
	@echo "  api      - Generate API proto files"
	@echo "  config   - Generate config proto files"
	@echo "  build    - Build the binary"
	@echo "  generate - Run go generate"
	@echo "  wire     - Generate wire dependencies"
	@echo "  test     - Run tests"
	@echo "  run      - Run the service"
	@echo "  docker   - Build docker image"
	@echo "  clean    - Clean build artifacts"
EOF

# Replace placeholders in Makefile
sed -i "s/SERVICE_LOWER/$SERVICE_LOWER/g" "$SERVICE_PATH/Makefile"
sed -i "s/SERVICE_NAME/$SERVICE_NAME/g" "$SERVICE_PATH/Makefile"

# =============================================================================
# Create config.yaml
# =============================================================================
print_info "Creating configs/config.yaml..."
cat > "$SERVICE_PATH/configs/config.yaml" << EOF
server:
  http:
    addr: 0.0.0.0:$HTTP_PORT
    timeout: 1s
  grpc:
    addr: 0.0.0.0:$GRPC_PORT
    timeout: 1s

data:
  database:
    driver: postgres
    source: postgres://user:password@localhost:5432/${SERVICE_LOWER}_db?sslmode=disable
  redis:
    addr: 127.0.0.1:6379
    read_timeout: 0.2s
    write_timeout: 0.2s

kafka:
  brokers:
    - localhost:9092
  group_id: ${SERVICE_LOWER}-group
  topics:
    - ${SERVICE_LOWER}-events
EOF

# =============================================================================
# Create main.go
# =============================================================================
print_info "Creating cmd/$SERVICE_LOWER/main.go..."
cat > "$SERVICE_PATH/cmd/$SERVICE_LOWER/main.go" << EOF
package main

import (
	"flag"
	"os"

	"$MODULE_NAME/internal/pkg/logger"

	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/config/file"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/transport/grpc"
	"github.com/go-kratos/kratos/v2/transport/http"
)

// go build -ldflags "-X main.Version=x.y.z"
var (
	Name    string = "$SERVICE_NAME"
	Version string

	flagconf string
	id, _    = os.Hostname()
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
		kratos.Server(gs, hs),
	)
}

func main() {
	flag.Parse()
	
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
		),
	)
	defer c.Close()

	if err := c.Load(); err != nil {
		panic(err)
	}

	app, cleanup, err := wireApp(c, logger)
	if err != nil {
		panic(err)
	}
	defer cleanup()

	if err := app.Run(); err != nil {
		panic(err)
	}
}
EOF

# =============================================================================
# Create wire.go
# =============================================================================
print_info "Creating cmd/$SERVICE_LOWER/wire.go..."
cat > "$SERVICE_PATH/cmd/$SERVICE_LOWER/wire.go" << EOF
//go:build wireinject
// +build wireinject

package main

import (
	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"

	"$MODULE_NAME/internal/server"
)

func wireApp(config.Config, log.Logger) (*kratos.App, func(), error) {
	panic(wire.Build(
		server.ProviderSet,
		newApp,
	))
}
EOF

# =============================================================================
# Create logger
# =============================================================================
print_info "Creating internal/pkg/logger/logger.go..."
cat > "$SERVICE_PATH/internal/pkg/logger/logger.go" << 'EOF'
package logger

import (
	"os"

	"github.com/go-kratos/kratos/v2/log"
)

type colorLogger struct {
	logger log.Logger
}

func New() log.Logger {
	return log.NewStdLogger(os.Stdout)
}
EOF

# =============================================================================
# Create server files
# =============================================================================
print_info "Creating server files..."

cat > "$SERVICE_PATH/internal/server/wire.go" << EOF
package server

import "github.com/google/wire"

var ProviderSet = wire.NewSet(NewGRPCServer, NewHTTPServer)
EOF

cat > "$SERVICE_PATH/internal/server/grpc.go" << EOF
package server

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/transport/grpc"
)

func NewGRPCServer(logger log.Logger) *grpc.Server {
	var opts = []grpc.ServerOption{
		grpc.Address(":$GRPC_PORT"),
	}
	srv := grpc.NewServer(opts...)
	// Register your gRPC services here
	return srv
}
EOF

cat > "$SERVICE_PATH/internal/server/http.go" << EOF
package server

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/transport/http"
)

func NewHTTPServer(logger log.Logger) *http.Server {
	var opts = []http.ServerOption{
		http.Address(":$HTTP_PORT"),
	}
	srv := http.NewServer(opts...)
	// Register your HTTP routes here
	return srv
}
EOF

# =============================================================================
# Create domain layer
# =============================================================================
print_info "Creating domain layer..."

cat > "$SERVICE_PATH/internal/domain/aggregate/${SERVICE_LOWER}.go" << EOF
package aggregate

import (
	"errors"
	"time"

	"$MODULE_NAME/internal/domain/event"
)

// ${SERVICE_PASCAL} is the aggregate root for ${SERVICE_LOWER} bounded context
type ${SERVICE_PASCAL} struct {
	ID        string
	CreatedAt time.Time
	UpdatedAt time.Time

	// Domain Events (unpublished)
	domainEvents []event.DomainEvent
}

// New${SERVICE_PASCAL} creates a new ${SERVICE_LOWER} aggregate
func New${SERVICE_PASCAL}(id string) (*${SERVICE_PASCAL}, error) {
	if id == "" {
		return nil, errors.New("${SERVICE_LOWER} ID cannot be empty")
	}

	now := time.Now()
	${SERVICE_LOWER} := &${SERVICE_PASCAL}{
		ID:           id,
		CreatedAt:    now,
		UpdatedAt:    now,
		domainEvents: make([]event.DomainEvent, 0),
	}

	// Raise domain event
	${SERVICE_LOWER}.addDomainEvent(event.New${SERVICE_PASCAL}CreatedEvent(id, now))

	return ${SERVICE_LOWER}, nil
}

func (a *${SERVICE_PASCAL}) addDomainEvent(e event.DomainEvent) {
	a.domainEvents = append(a.domainEvents, e)
}

func (a *${SERVICE_PASCAL}) GetDomainEvents() []event.DomainEvent {
	return a.domainEvents
}

func (a *${SERVICE_PASCAL}) ClearDomainEvents() {
	a.domainEvents = make([]event.DomainEvent, 0)
}
EOF

cat > "$SERVICE_PATH/internal/domain/event/domain_event.go" << 'EOF'
package event

import "time"

// DomainEvent represents a domain event
type DomainEvent interface {
	EventType() string
	OccurredAt() time.Time
}

// BaseDomainEvent is the base implementation
type BaseDomainEvent struct {
	Type       string
	OccurredOn time.Time
}

func (e BaseDomainEvent) EventType() string {
	return e.Type
}

func (e BaseDomainEvent) OccurredAt() time.Time {
	return e.OccurredOn
}
EOF

cat > "$SERVICE_PATH/internal/domain/event/${SERVICE_LOWER}_created.go" << EOF
package event

import "time"

type ${SERVICE_PASCAL}CreatedEvent struct {
	BaseDomainEvent
	${SERVICE_PASCAL}ID string
}

func New${SERVICE_PASCAL}CreatedEvent(id string, occurredAt time.Time) *${SERVICE_PASCAL}CreatedEvent {
	return &${SERVICE_PASCAL}CreatedEvent{
		BaseDomainEvent: BaseDomainEvent{
			Type:       "${SERVICE_LOWER}.created",
			OccurredOn: occurredAt,
		},
		${SERVICE_PASCAL}ID: id,
	}
}
EOF

cat > "$SERVICE_PATH/internal/domain/repository/${SERVICE_LOWER}_repository.go" << EOF
package repository

import (
	"context"

	"$MODULE_NAME/internal/domain/aggregate"
)

// ${SERVICE_PASCAL}Repository defines the contract for ${SERVICE_LOWER} persistence
type ${SERVICE_PASCAL}Repository interface {
	Save(ctx context.Context, ${SERVICE_LOWER} *aggregate.${SERVICE_PASCAL}) error
	FindByID(ctx context.Context, id string) (*aggregate.${SERVICE_PASCAL}, error)
	FindAll(ctx context.Context) ([]*aggregate.${SERVICE_PASCAL}, error)
	Delete(ctx context.Context, id string) error
}
EOF

cat > "$SERVICE_PATH/internal/domain/service/${SERVICE_LOWER}_domain_service.go" << EOF
package service

// ${SERVICE_PASCAL}DomainService contains domain logic that doesn't fit in aggregates
type ${SERVICE_PASCAL}DomainService struct{}

func New${SERVICE_PASCAL}DomainService() *${SERVICE_PASCAL}DomainService {
	return &${SERVICE_PASCAL}DomainService{}
}
EOF

# =============================================================================
# Create application layer
# =============================================================================
print_info "Creating application layer..."

cat > "$SERVICE_PATH/internal/application/command/create_${SERVICE_LOWER}.go" << EOF
package command

import (
	"context"

	"$MODULE_NAME/internal/domain/aggregate"
	"$MODULE_NAME/internal/domain/repository"
)

type Create${SERVICE_PASCAL}Command struct {
	ID string
}

type Create${SERVICE_PASCAL}Handler struct {
	repo repository.${SERVICE_PASCAL}Repository
}

func NewCreate${SERVICE_PASCAL}Handler(repo repository.${SERVICE_PASCAL}Repository) *Create${SERVICE_PASCAL}Handler {
	return &Create${SERVICE_PASCAL}Handler{repo: repo}
}

func (h *Create${SERVICE_PASCAL}Handler) Handle(ctx context.Context, cmd Create${SERVICE_PASCAL}Command) error {
	${SERVICE_LOWER}, err := aggregate.New${SERVICE_PASCAL}(cmd.ID)
	if err != nil {
		return err
	}

	return h.repo.Save(ctx, ${SERVICE_LOWER})
}
EOF

cat > "$SERVICE_PATH/internal/application/query/get_${SERVICE_LOWER}.go" << EOF
package query

import (
	"context"

	"$MODULE_NAME/internal/domain/aggregate"
	"$MODULE_NAME/internal/domain/repository"
)

type Get${SERVICE_PASCAL}Query struct {
	ID string
}

type Get${SERVICE_PASCAL}Handler struct {
	repo repository.${SERVICE_PASCAL}Repository
}

func NewGet${SERVICE_PASCAL}Handler(repo repository.${SERVICE_PASCAL}Repository) *Get${SERVICE_PASCAL}Handler {
	return &Get${SERVICE_PASCAL}Handler{repo: repo}
}

func (h *Get${SERVICE_PASCAL}Handler) Handle(ctx context.Context, query Get${SERVICE_PASCAL}Query) (*aggregate.${SERVICE_PASCAL}, error) {
	return h.repo.FindByID(ctx, query.ID)
}
EOF

cat > "$SERVICE_PATH/internal/application/handler/command_handler.go" << EOF
package handler

import (
	"context"

	"$MODULE_NAME/internal/application/command"
)

type CommandHandler struct {
	create${SERVICE_PASCAL}Handler *command.Create${SERVICE_PASCAL}Handler
}

func NewCommandHandler(createHandler *command.Create${SERVICE_PASCAL}Handler) *CommandHandler {
	return &CommandHandler{
		create${SERVICE_PASCAL}Handler: createHandler,
	}
}

func (h *CommandHandler) Create${SERVICE_PASCAL}(ctx context.Context, cmd command.Create${SERVICE_PASCAL}Command) error {
	return h.create${SERVICE_PASCAL}Handler.Handle(ctx, cmd)
}
EOF

cat > "$SERVICE_PATH/internal/application/handler/query_handler.go" << EOF
package handler

import (
	"context"

	"$MODULE_NAME/internal/application/query"
	"$MODULE_NAME/internal/domain/aggregate"
)

type QueryHandler struct {
	get${SERVICE_PASCAL}Handler *query.Get${SERVICE_PASCAL}Handler
}

func NewQueryHandler(getHandler *query.Get${SERVICE_PASCAL}Handler) *QueryHandler {
	return &QueryHandler{
		get${SERVICE_PASCAL}Handler: getHandler,
	}
}

func (h *QueryHandler) Get${SERVICE_PASCAL}(ctx context.Context, q query.Get${SERVICE_PASCAL}Query) (*aggregate.${SERVICE_PASCAL}, error) {
	return h.get${SERVICE_PASCAL}Handler.Handle(ctx, q)
}
EOF

# =============================================================================
# Create adapter layer
# =============================================================================
print_info "Creating adapter layer..."

cat > "$SERVICE_PATH/internal/adapter/persistence/postgres/${SERVICE_LOWER}_repo.go" << EOF
package postgres

import (
	"context"
	"database/sql"

	"$MODULE_NAME/internal/domain/aggregate"
	"$MODULE_NAME/internal/domain/repository"
)

type ${SERVICE_PASCAL}Repository struct {
	db *sql.DB
}

func New${SERVICE_PASCAL}Repository(db *sql.DB) repository.${SERVICE_PASCAL}Repository {
	return &${SERVICE_PASCAL}Repository{db: db}
}

func (r *${SERVICE_PASCAL}Repository) Save(ctx context.Context, ${SERVICE_LOWER} *aggregate.${SERVICE_PASCAL}) error {
	// TODO: Implement save logic
	return nil
}

func (r *${SERVICE_PASCAL}Repository) FindByID(ctx context.Context, id string) (*aggregate.${SERVICE_PASCAL}, error) {
	// TODO: Implement find by ID logic
	return nil, nil
}

func (r *${SERVICE_PASCAL}Repository) FindAll(ctx context.Context) ([]*aggregate.${SERVICE_PASCAL}, error) {
	// TODO: Implement find all logic
	return nil, nil
}

func (r *${SERVICE_PASCAL}Repository) Delete(ctx context.Context, id string) error {
	// TODO: Implement delete logic
	return nil
}
EOF

cat > "$SERVICE_PATH/internal/adapter/messaging/kafka/producer.go" << 'EOF'
package kafka

import (
	"context"

	"github.com/segmentio/kafka-go"
)

type Producer struct {
	writer *kafka.Writer
}

func NewProducer(brokers []string, topic string) *Producer {
	return &Producer{
		writer: &kafka.Writer{
			Addr:     kafka.TCP(brokers...),
			Topic:    topic,
			Balancer: &kafka.LeastBytes{},
		},
	}
}

func (p *Producer) Publish(ctx context.Context, key, value []byte) error {
	return p.writer.WriteMessages(ctx, kafka.Message{
		Key:   key,
		Value: value,
	})
}

func (p *Producer) Close() error {
	return p.writer.Close()
}
EOF

cat > "$SERVICE_PATH/internal/adapter/messaging/kafka/consumer.go" << 'EOF'
package kafka

import (
	"context"

	"github.com/segmentio/kafka-go"
)

type Consumer struct {
	reader *kafka.Reader
}

func NewConsumer(brokers []string, topic, groupID string) *Consumer {
	return &Consumer{
		reader: kafka.NewReader(kafka.ReaderConfig{
			Brokers: brokers,
			Topic:   topic,
			GroupID: groupID,
		}),
	}
}

func (c *Consumer) Consume(ctx context.Context, handler func([]byte) error) error {
	for {
		msg, err := c.reader.ReadMessage(ctx)
		if err != nil {
			return err
		}
		if err := handler(msg.Value); err != nil {
			return err
		}
	}
}

func (c *Consumer) Close() error {
	return c.reader.Close()
}
EOF

# =============================================================================
# Create transport layer
# =============================================================================
print_info "Creating transport layer..."

cat > "$SERVICE_PATH/internal/transport/grpc/${SERVICE_LOWER}_service.go" << EOF
package grpc

import (
	"context"

	"$MODULE_NAME/internal/application/handler"
)

type ${SERVICE_PASCAL}Service struct {
	commandHandler *handler.CommandHandler
	queryHandler   *handler.QueryHandler
}

func New${SERVICE_PASCAL}Service(
	cmdHandler *handler.CommandHandler,
	queryHandler *handler.QueryHandler,
) *${SERVICE_PASCAL}Service {
	return &${SERVICE_PASCAL}Service{
		commandHandler: cmdHandler,
		queryHandler:   queryHandler,
	}
}

// Implement your gRPC service methods here
func (s *${SERVICE_PASCAL}Service) Create${SERVICE_PASCAL}(ctx context.Context) error {
	// TODO: Implement
	return nil
}

func (s *${SERVICE_PASCAL}Service) Get${SERVICE_PASCAL}(ctx context.Context) error {
	// TODO: Implement
	return nil
}
EOF

# =============================================================================
# Create proto file
# =============================================================================
print_info "Creating proto file..."

cat > "$SERVICE_PATH/api/$SERVICE_LOWER/v1/${SERVICE_LOWER}.proto" << EOF
syntax = "proto3";

package ${SERVICE_LOWER}.v1;

option go_package = "$MODULE_NAME/api/${SERVICE_LOWER}/v1;v1";

import "google/api/annotations.proto";

service ${SERVICE_PASCAL}Service {
  rpc Create${SERVICE_PASCAL}(Create${SERVICE_PASCAL}Request) returns (Create${SERVICE_PASCAL}Response) {
    option (google.api.http) = {
      post: "/v1/${SERVICE_LOWER}s"
      body: "*"
    };
  }

  rpc Get${SERVICE_PASCAL}(Get${SERVICE_PASCAL}Request) returns (Get${SERVICE_PASCAL}Response) {
    option (google.api.http) = {
      get: "/v1/${SERVICE_LOWER}s/{id}"
    };
  }

  rpc List${SERVICE_PASCAL}s(List${SERVICE_PASCAL}sRequest) returns (List${SERVICE_PASCAL}sResponse) {
    option (google.api.http) = {
      get: "/v1/${SERVICE_LOWER}s"
    };
  }

  rpc Delete${SERVICE_PASCAL}(Delete${SERVICE_PASCAL}Request) returns (Delete${SERVICE_PASCAL}Response) {
    option (google.api.http) = {
      delete: "/v1/${SERVICE_LOWER}s/{id}"
    };
  }
}

message Create${SERVICE_PASCAL}Request {
  string name = 1;
}

message Create${SERVICE_PASCAL}Response {
  string id = 1;
}

message Get${SERVICE_PASCAL}Request {
  string id = 1;
}

message Get${SERVICE_PASCAL}Response {
  string id = 1;
  string name = 2;
  string created_at = 3;
}

message List${SERVICE_PASCAL}sRequest {
  int32 page = 1;
  int32 page_size = 2;
}

message List${SERVICE_PASCAL}sResponse {
  repeated Get${SERVICE_PASCAL}Response items = 1;
  int32 total = 2;
}

message Delete${SERVICE_PASCAL}Request {
  string id = 1;
}

message Delete${SERVICE_PASCAL}Response {
  bool success = 1;
}
EOF

# =============================================================================
# Create third_party proto files
# =============================================================================
print_info "Creating third_party proto files..."

cat > "$SERVICE_PATH/third_party/google/api/annotations.proto" << 'EOF'
syntax = "proto3";

package google.api;

import "google/api/http.proto";
import "google/protobuf/descriptor.proto";

option go_package = "google.golang.org/genproto/googleapis/api/annotations;annotations";

extend google.protobuf.MethodOptions {
  HttpRule http = 72295728;
}
EOF

cat > "$SERVICE_PATH/third_party/google/api/http.proto" << 'EOF'
syntax = "proto3";

package google.api;

option go_package = "google.golang.org/genproto/googleapis/api/annotations;annotations";

message Http {
  repeated HttpRule rules = 1;
  bool fully_decode_reserved_expansion = 2;
}

message HttpRule {
  string selector = 1;

  oneof pattern {
    string get = 2;
    string put = 3;
    string post = 4;
    string delete = 5;
    string patch = 6;
    CustomHttpPattern custom = 8;
  }

  string body = 7;
  string response_body = 12;
  repeated HttpRule additional_bindings = 11;
}

message CustomHttpPattern {
  string kind = 1;
  string path = 2;
}
EOF

# =============================================================================
# Create .gitignore
# =============================================================================
print_info "Creating .gitignore..."
cat > "$SERVICE_PATH/.gitignore" << 'EOF'
# Binaries
bin/
*.exe
*.exe~
*.dll
*.so
*.dylib

# Test binary
*.test

# Output of the go coverage tool
*.out

# Go workspace file
go.work

# IDE
.idea/
.vscode/
*.swp
*.swo

# Generated files
*_gen.go
*.pb.go

# Config files with secrets
configs/*.local.yaml

# OS
.DS_Store
Thumbs.db
EOF

# =============================================================================
# Create Dockerfile
# =============================================================================
print_info "Creating Dockerfile..."
cat > "$SERVICE_PATH/Dockerfile" << EOF
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache make git

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN make build

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /src/bin/$SERVICE_LOWER .
COPY --from=builder /src/configs ./configs

EXPOSE $HTTP_PORT $GRPC_PORT

CMD ["./$SERVICE_LOWER", "-conf", "./configs"]
EOF

# =============================================================================
# Create README.md
# =============================================================================
print_info "Creating README.md..."
cat > "$SERVICE_PATH/README.md" << EOF
# $SERVICE_NAME

A microservice built with Go Kratos framework following Clean Architecture and DDD principles.

## Architecture

\`\`\`
├── api/                    # Proto files and generated code
├── cmd/                    # Application entry points
├── configs/                # Configuration files
├── internal/
│   ├── adapter/            # Infrastructure adapters
│   │   ├── external/       # External service clients
│   │   ├── messaging/      # Message broker (Kafka)
│   │   └── persistence/    # Database repositories
│   ├── application/        # Application layer (CQRS)
│   │   ├── command/        # Command handlers
│   │   ├── query/          # Query handlers
│   │   ├── handler/        # Unified handlers
│   │   ├── event_handler/  # Domain event handlers
│   │   └── saga/           # Saga orchestrators
│   ├── domain/             # Domain layer (DDD)
│   │   ├── aggregate/      # Aggregate roots
│   │   ├── entity/         # Entities
│   │   ├── event/          # Domain events
│   │   ├── repository/     # Repository interfaces
│   │   ├── service/        # Domain services
│   │   └── valueobject/    # Value objects
│   ├── pkg/                # Shared packages
│   ├── server/             # Server setup
│   └── transport/          # Transport layer
│       ├── grpc/           # gRPC handlers
│       ├── http/           # HTTP handlers
│       └── consumer/       # Message consumers
└── third_party/            # Third-party proto files
\`\`\`

## Getting Started

### Prerequisites

- Go 1.23+
- Protocol Buffers compiler
- Make

### Install dependencies

\`\`\`bash
make init
\`\`\`

### Generate proto files

\`\`\`bash
make api
\`\`\`

### Generate wire dependencies

\`\`\`bash
make wire
\`\`\`

### Run the service

\`\`\`bash
make run
\`\`\`

### Build

\`\`\`bash
make build
\`\`\`

## Ports

- HTTP: $HTTP_PORT
- gRPC: $GRPC_PORT
EOF

print_success "Go Kratos service '$SERVICE_NAME' created successfully!"
print_info ""
print_info "Next steps:"
print_info "  1. cd $SERVICE_PATH"
print_info "  2. make init     # Install required tools"
print_info "  3. go mod tidy   # Download dependencies"
print_info "  4. make api      # Generate proto files"
print_info "  5. make wire     # Generate wire dependencies"
print_info "  6. make run      # Run the service"
