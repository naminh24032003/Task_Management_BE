.PHONY: build dev build-image run-image proto-gen proto-watch clean help

# Proto directories
PROTO_DIR = ../../packages/proto
OUT_DIR = ./src/generated

help: ## Show available commands
	@echo Available commands:
	@echo   make proto-gen    - Generate TypeScript types from proto files
	@echo   make proto-watch  - Watch proto files for changes
	@echo   make build        - Build the service (auto-generates proto first)
	@echo   make dev          - Start dev server (auto-generates proto first)
	@echo   make clean        - Clean generated files
	@echo   make build-image  - Build Docker image
	@echo   make run-image    - Run Docker container

# Generate TypeScript from proto files
proto-gen: ## Generate TypeScript types from proto files
	@echo Generating TypeScript types from proto files...
	@scripts\generate-proto.cmd

# Watch proto files and regenerate on change
proto-watch: ## Watch proto files for changes
	@echo Watching proto files for changes...
	@npx nodemon --watch "$(PROTO_DIR)/user" -e proto --exec "npm run proto:gen"

# Clean generated files
clean: ## Clean generated files
	@echo Cleaning generated files...
	@if exist "$(OUT_DIR)" rd /s /q "$(OUT_DIR)"
	@echo Cleaned!

build: proto-gen ## Build the service (auto-generates proto first)
	npm run build

dev: proto-gen ## Start dev server (auto-generates proto first)
	npm run start:dev

build-image:
	docker build -t user-service -f Dockerfile ../../

run-image:
	docker run -p 50051:50051 user-service

.DEFAULT_GOAL := help
