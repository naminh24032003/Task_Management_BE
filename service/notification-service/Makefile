.PHONY: all build run test clean docker-build docker-push lint fmt tidy wire

# Variables
APP_NAME := notification-service
MAIN_PATH := ./cmd/notification
BUILD_DIR := ./bin
DOCKER_REGISTRY := your-registry
DOCKER_IMAGE := $(DOCKER_REGISTRY)/$(APP_NAME)
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

# Go variables
GOCMD := go
GOBUILD := $(GOCMD) build
GOTEST := $(GOCMD) test
GOMOD := $(GOCMD) mod
GOFMT := gofmt
GOLINT := golangci-lint

# Build flags
LDFLAGS := -ldflags "-w -s -X main.Version=$(VERSION)"

all: lint test build

## build: Build the application
build:
	@echo "Building $(APP_NAME)..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(APP_NAME) $(MAIN_PATH)
	@echo "Build complete: $(BUILD_DIR)/$(APP_NAME)"

## run: Run the application locally
run:
	@echo "Running $(APP_NAME)..."
	$(GOCMD) run $(MAIN_PATH) -config configs/local.yaml

## test: Run tests
test:
	@echo "Running tests..."
	$(GOTEST) -v -race -cover ./...

## test-coverage: Run tests with coverage report
test-coverage:
	@echo "Running tests with coverage..."
	$(GOTEST) -v -race -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

## clean: Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@rm -f coverage.out coverage.html
	@echo "Clean complete"

## lint: Run linter
lint:
	@echo "Running linter..."
	$(GOLINT) run ./...

## fmt: Format code
fmt:
	@echo "Formatting code..."
	$(GOFMT) -s -w .

## tidy: Tidy go modules
tidy:
	@echo "Tidying modules..."
	$(GOMOD) tidy

## wire: Generate wire code
wire:
	@echo "Generating wire code..."
	cd $(MAIN_PATH) && wire

## docker-build: Build Docker image
docker-build:
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE):$(VERSION) -t $(DOCKER_IMAGE):latest .
	@echo "Docker image built: $(DOCKER_IMAGE):$(VERSION)"

## docker-push: Push Docker image
docker-push:
	@echo "Pushing Docker image..."
	docker push $(DOCKER_IMAGE):$(VERSION)
	docker push $(DOCKER_IMAGE):latest

## docker-run: Run Docker container locally
docker-run:
	@echo "Running Docker container..."
	docker run --rm -it \
		-p 9093:9093 \
		-e KAFKA_BROKERS=host.docker.internal:9092 \
		-e MONGODB_URI=mongodb://host.docker.internal:27017 \
		-e REDIS_ADDR=host.docker.internal:6379 \
		$(DOCKER_IMAGE):latest

## minikube-build: Build image for Minikube
minikube-build:
	@echo "Building image for Minikube..."
	docker build -t $(APP_NAME):latest -f Dockerfile ../../
	minikube image load $(APP_NAME):latest
	@echo "Image built and loaded in Minikube"

## minikube-logs: View logs in Minikube
minikube-logs:
	kubectl logs -f -n dev -l app.kubernetes.io/instance=$(APP_NAME) -c microservice

## help: Show help
help:
	@echo "Available targets:"
	@sed -n 's/^##//p' $(MAKEFILE_LIST) | column -t -s ':' | sed -e 's/^/ /'

# Default target
.DEFAULT_GOAL := help
