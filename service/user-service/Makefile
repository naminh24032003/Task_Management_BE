.PHONY: build
build:
	npm run build

.PHONY: dev
dev:
	npm run start:dev

.PHONY: build-image
build-image:
	docker build -t user-service -f Dockerfile ../../

.PHONY: run-image
run-image:
	docker run -p 50051:50051 user-service
