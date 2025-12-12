GOHOSTOS:=$(shell go env GOHOSTOS)
GOPATH:=$(shell go env GOPATH)

ifeq ($(GOHOSTOS), windows)
	Git_Bash=$(subst \,/,$(subst cmd\,bin\bash.exe,$(dir $(shell where git))))
	PROTO_FILES=$(shell $(Git_Bash) -c "find api -name *.proto")
else
	PROTO_FILES=$(shell find api -name *.proto)
endif

.PHONY: init
# init env - install required tools
init:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@latest

.PHONY: api
# generate api proto files
api:
	protoc --proto_path=./api \
	       --go_out=paths=source_relative:./api \
	       --go-grpc_out=paths=source_relative:./api \
	       $(PROTO_FILES)

.PHONY: clean
# clean generated files
clean:
	find api -name "*.pb.go" -type f -delete

.PHONY: all
# generate all
all:
	make api

# Show help
help:
	@echo ''
	@echo 'Usage:'
	@echo ' make [target]'
	@echo ''
	@echo 'Targets:'
	@awk '/^[a-zA-Z\-\_0-9]+:/ { \
	helpMessage = match(lastLine, /^# (.*)/); \
		if (helpMessage) { \
			helpCommand = substr($$1, 0, index($$1, ":")); \
			helpMessage = substr(lastLine, RSTART + 2, RLENGTH); \
			printf "\033[36m%-22s\033[0m %s\n", helpCommand,helpMessage; \
		} \
	} \
	{ lastLine = $$0 }' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help
