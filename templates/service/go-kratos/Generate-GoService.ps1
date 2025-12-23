# =============================================================================
# Go Kratos Service Generator (PowerShell)
# Based on task-service architecture (Clean Architecture + DDD + CQRS)
# =============================================================================

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$ServiceName,
    
    [Parameter()]
    [string]$Directory = "./service",
    
    [Parameter()]
    [string]$Module = "",
    
    [Parameter()]
    [string]$HttpPort = "8000",
    
    [Parameter()]
    [string]$GrpcPort = "9000"
)

# Colors
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Blue }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Warning { Write-Host "[WARNING] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }

# Set default module name
if ([string]::IsNullOrEmpty($Module)) {
    $Module = $ServiceName
}

# Convert names
$ServiceShort = $ServiceName -replace '-service$', ''
$ServicePascal = ($ServiceShort -split '-' | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) }) -join ''
$ServiceLower = $ServiceShort.ToLower()

$ServicePath = Join-Path $Directory $ServiceName

Write-Info "Creating Go Kratos service: $ServiceName"
Write-Info "Target directory: $ServicePath"
Write-Info "Module name: $Module"

# Check if exists
if (Test-Path $ServicePath) {
    Write-Error "Directory $ServicePath already exists!"
    exit 1
}

# Create directories
Write-Info "Creating directory structure..."

$dirs = @(
    "api/$ServiceLower/v1",
    "cmd/$ServiceLower",
    "configs",
    "internal/adapter/external",
    "internal/adapter/messaging/kafka",
    "internal/adapter/persistence/postgres",
    "internal/application/command",
    "internal/application/event_handler",
    "internal/application/handler",
    "internal/application/query",
    "internal/application/saga",
    "internal/domain/aggregate",
    "internal/domain/entity",
    "internal/domain/event",
    "internal/domain/repository",
    "internal/domain/service",
    "internal/domain/valueobject",
    "internal/pkg/logger",
    "internal/server",
    "internal/transport/consumer",
    "internal/transport/grpc",
    "internal/transport/http",
    "third_party/google/api"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path (Join-Path $ServicePath $dir) -Force | Out-Null
}

Write-Success "Directory structure created!"

# =============================================================================
# Create go.mod
# =============================================================================
Write-Info "Creating go.mod..."
@"
module $Module

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
"@ | Out-File -FilePath (Join-Path $ServicePath "go.mod") -Encoding utf8

# =============================================================================
# Create Makefile
# =============================================================================
Write-Info "Creating Makefile..."
@"
GOHOSTOS:=`$(shell go env GOHOSTOS)
GOPATH:=`$(shell go env GOPATH)
VERSION=`$(shell git describe --tags --always)

ifeq (`$(GOHOSTOS), windows)
	Git_Bash=`$(subst \,/,`$(subst cmd\,bin\bash.exe,`$(dir `$(shell where git))))
	INTERNAL_PROTO_FILES=`$(shell `$(Git_Bash) -c "find internal -name *.proto")
	API_PROTO_FILES=`$(shell `$(Git_Bash) -c "find api -name *.proto")
else
	INTERNAL_PROTO_FILES=`$(shell find internal -name *.proto)
	API_PROTO_FILES=`$(shell find api -name *.proto)
endif

.PHONY: init
init:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/go-kratos/kratos/cmd/kratos/v2@latest
	go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@latest
	go install github.com/google/gnostic/cmd/protoc-gen-openapi@latest
	go install github.com/google/wire/cmd/wire@latest

.PHONY: api
api:
	protoc --proto_path=./api \
	       --proto_path=./third_party \
	       --go_out=paths=source_relative:./api \
	       --go-http_out=paths=source_relative:./api \
	       --go-grpc_out=paths=source_relative:./api \
	       --openapi_out=fq_schema_naming=true,default_response=false:. \
	       `$(API_PROTO_FILES)

.PHONY: build
build:
	mkdir -p bin/ && go build -ldflags "-X main.Version=`$(VERSION)" -o ./bin/ ./...

.PHONY: wire
wire:
	cd cmd/$ServiceLower && wire

.PHONY: test
test:
	go test -v ./...

.PHONY: run
run:
	go run ./cmd/$ServiceLower -conf ./configs

.PHONY: all
all: api build
"@ | Out-File -FilePath (Join-Path $ServicePath "Makefile") -Encoding utf8

# =============================================================================
# Create config.yaml
# =============================================================================
Write-Info "Creating configs/config.yaml..."
@"
server:
  http:
    addr: 0.0.0.0:$HttpPort
    timeout: 1s
  grpc:
    addr: 0.0.0.0:$GrpcPort
    timeout: 1s

data:
  database:
    driver: postgres
    source: postgres://user:password@localhost:5432/${ServiceLower}_db?sslmode=disable
  redis:
    addr: 127.0.0.1:6379
    read_timeout: 0.2s
    write_timeout: 0.2s

kafka:
  brokers:
    - localhost:9092
  group_id: ${ServiceLower}-group
  topics:
    - ${ServiceLower}-events
"@ | Out-File -FilePath (Join-Path $ServicePath "configs/config.yaml") -Encoding utf8

# =============================================================================
# Create main.go
# =============================================================================
Write-Info "Creating cmd/$ServiceLower/main.go..."
@"
package main

import (
	"flag"
	"os"

	"$Module/internal/pkg/logger"

	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/config/file"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/transport/grpc"
	"github.com/go-kratos/kratos/v2/transport/http"
)

var (
	Name    string = "$ServiceName"
	Version string
	flagconf string
	id, _    = os.Hostname()
)

func init() {
	flag.StringVar(&flagconf, "conf", "../../configs", "config path")
}

func newApp(logger log.Logger, gs *grpc.Server, hs *http.Server) *kratos.App {
	return kratos.New(
		kratos.ID(id),
		kratos.Name(Name),
		kratos.Version(Version),
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
		config.WithSource(file.NewSource(flagconf)),
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
"@ | Out-File -FilePath (Join-Path $ServicePath "cmd/$ServiceLower/main.go") -Encoding utf8

# =============================================================================
# Create wire.go
# =============================================================================
Write-Info "Creating cmd/$ServiceLower/wire.go..."
@"
//go:build wireinject
// +build wireinject

package main

import (
	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"

	"$Module/internal/server"
)

func wireApp(config.Config, log.Logger) (*kratos.App, func(), error) {
	panic(wire.Build(
		server.ProviderSet,
		newApp,
	))
}
"@ | Out-File -FilePath (Join-Path $ServicePath "cmd/$ServiceLower/wire.go") -Encoding utf8

# =============================================================================
# Create logger
# =============================================================================
Write-Info "Creating internal/pkg/logger/logger.go..."
@"
package logger

import (
	"os"
	"github.com/go-kratos/kratos/v2/log"
)

func New() log.Logger {
	return log.NewStdLogger(os.Stdout)
}
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/pkg/logger/logger.go") -Encoding utf8

# =============================================================================
# Create server files
# =============================================================================
Write-Info "Creating server files..."

@"
package server

import "github.com/google/wire"

var ProviderSet = wire.NewSet(NewGRPCServer, NewHTTPServer)
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/server/wire.go") -Encoding utf8

@"
package server

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/transport/grpc"
)

func NewGRPCServer(logger log.Logger) *grpc.Server {
	srv := grpc.NewServer(grpc.Address(":$GrpcPort"))
	return srv
}
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/server/grpc.go") -Encoding utf8

@"
package server

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/transport/http"
)

func NewHTTPServer(logger log.Logger) *http.Server {
	srv := http.NewServer(http.Address(":$HttpPort"))
	return srv
}
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/server/http.go") -Encoding utf8

# =============================================================================
# Create domain layer
# =============================================================================
Write-Info "Creating domain layer..."

@"
package aggregate

import (
	"errors"
	"time"
	"$Module/internal/domain/event"
)

type $ServicePascal struct {
	ID        string
	CreatedAt time.Time
	UpdatedAt time.Time
	domainEvents []event.DomainEvent
}

func New$ServicePascal(id string) (*$ServicePascal, error) {
	if id == "" {
		return nil, errors.New("$ServiceLower ID cannot be empty")
	}

	now := time.Now()
	$ServiceLower := &$ServicePascal{
		ID:           id,
		CreatedAt:    now,
		UpdatedAt:    now,
		domainEvents: make([]event.DomainEvent, 0),
	}

	$ServiceLower.addDomainEvent(event.New${ServicePascal}CreatedEvent(id, now))
	return $ServiceLower, nil
}

func (a *$ServicePascal) addDomainEvent(e event.DomainEvent) {
	a.domainEvents = append(a.domainEvents, e)
}

func (a *$ServicePascal) GetDomainEvents() []event.DomainEvent {
	return a.domainEvents
}

func (a *$ServicePascal) ClearDomainEvents() {
	a.domainEvents = make([]event.DomainEvent, 0)
}
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/domain/aggregate/$ServiceLower.go") -Encoding utf8

@"
package event

import "time"

type DomainEvent interface {
	EventType() string
	OccurredAt() time.Time
}

type BaseDomainEvent struct {
	Type       string
	OccurredOn time.Time
}

func (e BaseDomainEvent) EventType() string  { return e.Type }
func (e BaseDomainEvent) OccurredAt() time.Time { return e.OccurredOn }
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/domain/event/domain_event.go") -Encoding utf8

@"
package event

import "time"

type ${ServicePascal}CreatedEvent struct {
	BaseDomainEvent
	${ServicePascal}ID string
}

func New${ServicePascal}CreatedEvent(id string, occurredAt time.Time) *${ServicePascal}CreatedEvent {
	return &${ServicePascal}CreatedEvent{
		BaseDomainEvent: BaseDomainEvent{
			Type:       "$ServiceLower.created",
			OccurredOn: occurredAt,
		},
		${ServicePascal}ID: id,
	}
}
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/domain/event/${ServiceLower}_created.go") -Encoding utf8

@"
package repository

import (
	"context"
	"$Module/internal/domain/aggregate"
)

type ${ServicePascal}Repository interface {
	Save(ctx context.Context, $ServiceLower *aggregate.$ServicePascal) error
	FindByID(ctx context.Context, id string) (*aggregate.$ServicePascal, error)
	FindAll(ctx context.Context) ([]*aggregate.$ServicePascal, error)
	Delete(ctx context.Context, id string) error
}
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/domain/repository/${ServiceLower}_repository.go") -Encoding utf8

# =============================================================================
# Create application layer
# =============================================================================
Write-Info "Creating application layer..."

@"
package command

import (
	"context"
	"$Module/internal/domain/aggregate"
	"$Module/internal/domain/repository"
)

type Create${ServicePascal}Command struct {
	ID string
}

type Create${ServicePascal}Handler struct {
	repo repository.${ServicePascal}Repository
}

func NewCreate${ServicePascal}Handler(repo repository.${ServicePascal}Repository) *Create${ServicePascal}Handler {
	return &Create${ServicePascal}Handler{repo: repo}
}

func (h *Create${ServicePascal}Handler) Handle(ctx context.Context, cmd Create${ServicePascal}Command) error {
	$ServiceLower, err := aggregate.New$ServicePascal(cmd.ID)
	if err != nil {
		return err
	}
	return h.repo.Save(ctx, $ServiceLower)
}
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/application/command/create_$ServiceLower.go") -Encoding utf8

@"
package query

import (
	"context"
	"$Module/internal/domain/aggregate"
	"$Module/internal/domain/repository"
)

type Get${ServicePascal}Query struct {
	ID string
}

type Get${ServicePascal}Handler struct {
	repo repository.${ServicePascal}Repository
}

func NewGet${ServicePascal}Handler(repo repository.${ServicePascal}Repository) *Get${ServicePascal}Handler {
	return &Get${ServicePascal}Handler{repo: repo}
}

func (h *Get${ServicePascal}Handler) Handle(ctx context.Context, query Get${ServicePascal}Query) (*aggregate.$ServicePascal, error) {
	return h.repo.FindByID(ctx, query.ID)
}
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/application/query/get_$ServiceLower.go") -Encoding utf8

# =============================================================================
# Create adapter layer
# =============================================================================
Write-Info "Creating adapter layer..."

@"
package postgres

import (
	"context"
	"database/sql"
	"$Module/internal/domain/aggregate"
	"$Module/internal/domain/repository"
)

type ${ServicePascal}Repository struct {
	db *sql.DB
}

func New${ServicePascal}Repository(db *sql.DB) repository.${ServicePascal}Repository {
	return &${ServicePascal}Repository{db: db}
}

func (r *${ServicePascal}Repository) Save(ctx context.Context, $ServiceLower *aggregate.$ServicePascal) error {
	return nil
}

func (r *${ServicePascal}Repository) FindByID(ctx context.Context, id string) (*aggregate.$ServicePascal, error) {
	return nil, nil
}

func (r *${ServicePascal}Repository) FindAll(ctx context.Context) ([]*aggregate.$ServicePascal, error) {
	return nil, nil
}

func (r *${ServicePascal}Repository) Delete(ctx context.Context, id string) error {
	return nil
}
"@ | Out-File -FilePath (Join-Path $ServicePath "internal/adapter/persistence/postgres/${ServiceLower}_repo.go") -Encoding utf8

# =============================================================================
# Create proto file
# =============================================================================
Write-Info "Creating proto file..."

@"
syntax = "proto3";

package ${ServiceLower}.v1;

option go_package = "$Module/api/${ServiceLower}/v1;v1";

import "google/api/annotations.proto";

service ${ServicePascal}Service {
  rpc Create${ServicePascal}(Create${ServicePascal}Request) returns (Create${ServicePascal}Response) {
    option (google.api.http) = {
      post: "/v1/${ServiceLower}s"
      body: "*"
    };
  }

  rpc Get${ServicePascal}(Get${ServicePascal}Request) returns (Get${ServicePascal}Response) {
    option (google.api.http) = {
      get: "/v1/${ServiceLower}s/{id}"
    };
  }

  rpc List${ServicePascal}s(List${ServicePascal}sRequest) returns (List${ServicePascal}sResponse) {
    option (google.api.http) = {
      get: "/v1/${ServiceLower}s"
    };
  }

  rpc Delete${ServicePascal}(Delete${ServicePascal}Request) returns (Delete${ServicePascal}Response) {
    option (google.api.http) = {
      delete: "/v1/${ServiceLower}s/{id}"
    };
  }
}

message Create${ServicePascal}Request {
  string name = 1;
}

message Create${ServicePascal}Response {
  string id = 1;
}

message Get${ServicePascal}Request {
  string id = 1;
}

message Get${ServicePascal}Response {
  string id = 1;
  string name = 2;
  string created_at = 3;
}

message List${ServicePascal}sRequest {
  int32 page = 1;
  int32 page_size = 2;
}

message List${ServicePascal}sResponse {
  repeated Get${ServicePascal}Response items = 1;
  int32 total = 2;
}

message Delete${ServicePascal}Request {
  string id = 1;
}

message Delete${ServicePascal}Response {
  bool success = 1;
}
"@ | Out-File -FilePath (Join-Path $ServicePath "api/$ServiceLower/v1/$ServiceLower.proto") -Encoding utf8

# =============================================================================
# Create third_party proto files
# =============================================================================
Write-Info "Creating third_party proto files..."

@"
syntax = "proto3";

package google.api;

import "google/api/http.proto";
import "google/protobuf/descriptor.proto";

option go_package = "google.golang.org/genproto/googleapis/api/annotations;annotations";

extend google.protobuf.MethodOptions {
  HttpRule http = 72295728;
}
"@ | Out-File -FilePath (Join-Path $ServicePath "third_party/google/api/annotations.proto") -Encoding utf8

@"
syntax = "proto3";

package google.api;

option go_package = "google.golang.org/genproto/googleapis/api/annotations;annotations";

message Http {
  repeated HttpRule rules = 1;
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
"@ | Out-File -FilePath (Join-Path $ServicePath "third_party/google/api/http.proto") -Encoding utf8

# =============================================================================
# Create .gitignore
# =============================================================================
Write-Info "Creating .gitignore..."
@"
bin/
*.exe
*.test
*.out
go.work
.idea/
.vscode/
*_gen.go
*.pb.go
configs/*.local.yaml
.DS_Store
"@ | Out-File -FilePath (Join-Path $ServicePath ".gitignore") -Encoding utf8

# =============================================================================
# Create README.md
# =============================================================================
Write-Info "Creating README.md..."
@"
# $ServiceName

Go Kratos service with Clean Architecture + DDD + CQRS

## Structure

- api/          - Proto files
- cmd/          - Entry points
- configs/      - Configuration
- internal/
  - adapter/    - Infrastructure
  - application/- CQRS handlers
  - domain/     - DDD (aggregates, events, repositories)
  - server/     - Server setup
  - transport/  - gRPC/HTTP handlers

## Commands

``````
make init      # Install tools
make api       # Generate proto
make wire      # Generate DI
make run       # Run service
make build     # Build binary
``````

## Ports

- HTTP: $HttpPort
- gRPC: $GrpcPort
"@ | Out-File -FilePath (Join-Path $ServicePath "README.md") -Encoding utf8

Write-Success "Go Kratos service '$ServiceName' created successfully!"
Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. cd $ServicePath"
Write-Host "  2. go mod tidy"
Write-Host "  3. make init"
Write-Host "  4. make api"
Write-Host "  5. make wire"
Write-Host "  6. make run"
