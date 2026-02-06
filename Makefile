.PHONY: help build run test clean docker-build-app docker-build-docreader docker-build-frontend docker-build-all docker-run migrate-up migrate-down docker-restart docker-stop start-all start-all-local start-all-full start-all-local-full stop-all start-ollama stop-ollama build-images build-images-app build-images-docreader build-images-frontend clean-images check-env list-containers pull-images show-platform dev-start dev-stop dev-restart dev-logs dev-status dev-app dev-frontend docs install-swagger

# Show help
help:
	@echo "WeKnora Makefile Help"
	@echo ""
	@echo "Basic Commands:"
	@echo "  build             Build application"
	@echo "  run               Run application"
	@echo "  test              Run tests"
	@echo "  clean             Clean build files"
	@echo ""
	@echo "Docker Commands:"
	@echo "  docker-build-app        Build application Docker image (wechatopenai/weknora-app)"
	@echo "  docker-build-docreader Build document reader image (wechatopenai/weknora-docreader)"
	@echo "  docker-build-frontend   Build frontend image (wechatopenai/weknora-ui)"
	@echo "  docker-build-all        Build all Docker images"
	@echo "  docker-run              Run Docker containers"
	@echo "  docker-stop             Stop Docker containers"
	@echo "  docker-restart          Restart Docker containers"
	@echo ""
	@echo "Service Management:"
	@echo "  start-all              Start all services (pulls from registry)"
	@echo "  start-all-local        Start all services (build from local source)"
	@echo "  start-all-full         Start all services with full profile (includes minio, jaeger, neo4j, qdrant)"
	@echo "  start-all-local-full   Start all services with full profile (build from local source)"
	@echo "  stop-all               Stop all services"
	@echo "  start-ollama           Start Ollama service only"
	@echo ""
	@echo "Image Building:"
	@echo "  build-images      Build all images from source"
	@echo "  build-images-app  Build application image from source"
	@echo "  build-images-docreader Build document reader image from source"
	@echo "  build-images-frontend  Build frontend image from source"
	@echo "  clean-images      Clean local images"
	@echo ""
	@echo "Database:"
	@echo "  migrate-up        Run database migrations"
	@echo "  migrate-down      Rollback database migrations"
	@echo ""
	@echo "Development Tools:"
	@echo "  fmt               Format code"
	@echo "  lint              Lint code"
	@echo "  deps              Install dependencies"
	@echo "  docs              Generate Swagger API documentation"
	@echo "  install-swagger   Install swag tool"
	@echo ""
	@echo "Environment Check:"
	@echo "  check-env         Check environment configuration"
	@echo "  list-containers   List running containers"
	@echo "  pull-images       Pull latest images"
	@echo "  show-platform     Show current build platform"
	@echo ""
	@echo "Development Mode (Recommended):"
	@echo "  dev-start         Start development infrastructure (only dependency services)"
	@echo "  dev-stop          Stop development environment"
	@echo "  dev-restart       Restart development environment"
	@echo "  dev-logs          View development environment logs"
	@echo "  dev-status        View development environment status"
	@echo "  dev-app           Start backend application (run locally, requires dev-start first)"
	@echo "  dev-frontend      Start frontend (run locally, requires dev-start first)"

# Go related variables
BINARY_NAME=WeKnora
MAIN_PATH=./cmd/server

# Docker related variables
DOCKER_IMAGE=wechatopenai/weknora-app
DOCKER_TAG=latest

# Platform detection
ifeq ($(shell uname -m),x86_64)
    PLATFORM=linux/amd64
else ifeq ($(shell uname -m),aarch64)
    PLATFORM=linux/arm64
else ifeq ($(shell uname -m),arm64)
    PLATFORM=linux/arm64
else
    PLATFORM=linux/amd64
endif

# Build the application
build:
	go build -o $(BINARY_NAME) $(MAIN_PATH)

# Run the application
run: build
	./$(BINARY_NAME)

# Run tests
test:
	go test -v ./...

# Clean build artifacts
clean:
	go clean
	rm -f $(BINARY_NAME)

# Build Docker image
docker-build-app:
	@echo "Getting version information..."
	@eval $$(./scripts/get_version.sh env); \
	./scripts/get_version.sh info; \
	docker build --platform $(PLATFORM) \
		--build-arg VERSION_ARG="$$VERSION" \
		--build-arg COMMIT_ID_ARG="$$COMMIT_ID" \
		--build-arg BUILD_TIME_ARG="$$BUILD_TIME" \
		--build-arg GO_VERSION_ARG="$$GO_VERSION" \
		-f docker/Dockerfile.app -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

# Build docreader Docker image
docker-build-docreader:
	docker build --platform $(PLATFORM) -f docker/Dockerfile.docreader -t wechatopenai/weknora-docreader:latest .

# Build frontend Docker image
docker-build-frontend:
	docker build --platform $(PLATFORM) -f frontend/Dockerfile -t wechatopenai/weknora-ui:latest frontend/

# Build all Docker images
docker-build-all: docker-build-app docker-build-docreader docker-build-frontend

# Run Docker container (traditional way)
docker-run:
	docker-compose up

# Start all services using new script
start-all:
	./scripts/start_all.sh

# Start all services with local build (no pull from registry)
start-all-local:
	./scripts/start_all.sh --no-pull

# Start all services with full profile (includes minio, jaeger, neo4j, qdrant)
start-all-full:
	COMPOSE_PROFILES=full ./scripts/start_all.sh

# Start all services with full profile and local build
start-all-local-full:
	COMPOSE_PROFILES=full ./scripts/start_all.sh --no-pull

# Start only Ollama service using new script
start-ollama:
	./scripts/start_all.sh --ollama

# Start only Docker containers using new script
start-docker:
	./scripts/start_all.sh --docker

# Stop all services using new script
stop-all:
	./scripts/start_all.sh --stop

# Stop Docker container (traditional way)
docker-stop:
	docker-compose down

# Build images from source related commands
build-images:
	./scripts/build_images.sh

build-images-app:
	./scripts/build_images.sh --app

build-images-docreader:
	./scripts/build_images.sh --docreader

build-images-frontend:
	./scripts/build_images.sh --frontend

clean-images:
	./scripts/build_images.sh --clean

# Restart Docker container (stop, start)
docker-restart:
	docker-compose stop -t 60
	docker-compose up

# Database migrations
migrate-up:
	./scripts/migrate.sh up

migrate-down:
	./scripts/migrate.sh down

migrate-version:
	./scripts/migrate.sh version

migrate-create:
	@if [ -z "$(name)" ]; then \
		echo "Error: migration name is required"; \
		echo "Usage: make migrate-create name=your_migration_name"; \
		exit 1; \
	fi
	./scripts/migrate.sh create $(name)

migrate-force:
	@if [ -z "$(version)" ]; then \
		echo "Error: version is required"; \
		echo "Usage: make migrate-force version=4"; \
		exit 1; \
	fi
	./scripts/migrate.sh force $(version)

migrate-goto:
	@if [ -z "$(version)" ]; then \
		echo "Error: version is required"; \
		echo "Usage: make migrate-goto version=3"; \
		exit 1; \
	fi
	./scripts/migrate.sh goto $(version)

# Generate API documentation (Swagger)
docs:
	@echo "Generating Swagger API documentation..."
	swag init -g $(MAIN_PATH)/main.go -o ./docs --parseDependency --parseInternal
	@echo "Documentation generated to ./docs directory"
	@echo "After starting the service, visit http://localhost:8080/swagger/index.html to view the documentation"

# Install swagger tool
install-swagger:
	go install github.com/swaggo/swag/cmd/swag@latest

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	golangci-lint run

# Install dependencies
deps:
	go mod download

# Build for production
build-prod:
	VERSION=$$(git describe --tags --abbrev=0 2>/dev/null || echo "$${VERSION:-unknown}"); \
	COMMIT_ID=$${COMMIT_ID:-unknown}; \
	BUILD_TIME=$${BUILD_TIME:-unknown}; \
	GO_VERSION=$${GO_VERSION:-unknown}; \
	LDFLAGS="-X 'github.com/Tencent/WeKnora/internal/handler.Version=$$VERSION' -X 'github.com/Tencent/WeKnora/internal/handler.CommitID=$$COMMIT_ID' -X 'github.com/Tencent/WeKnora/internal/handler.BuildTime=$$BUILD_TIME' -X 'github.com/Tencent/WeKnora/internal/handler.GoVersion=$$GO_VERSION'"; \
	go build -ldflags="-w -s $$LDFLAGS" -o $(BINARY_NAME) $(MAIN_PATH)

download_spatial:
	go run cmd/download/duckdb/duckdb.go

clean-db:
	@echo "Cleaning database..."
	@if [ $$(docker volume ls -q -f name=weknora_postgres-data) ]; then \
		docker volume rm weknora_postgres-data; \
	fi
	@if [ $$(docker volume ls -q -f name=weknora_minio_data) ]; then \
		docker volume rm weknora_minio_data; \
	fi
	@if [ $$(docker volume ls -q -f name=weknora_redis_data) ]; then \
		docker volume rm weknora_redis_data; \
	fi

# Environment check
check-env:
	./scripts/start_all.sh --check

# List containers
list-containers:
	./scripts/start_all.sh --list

# Pull latest images
pull-images:
	./scripts/start_all.sh --pull

# Show current platform
show-platform:
	@echo "Current system architecture: $(shell uname -m)"
	@echo "Docker build platform: $(PLATFORM)"

# Development mode commands
dev-start:
	./scripts/dev.sh start

dev-stop:
	./scripts/dev.sh stop

dev-restart:
	./scripts/dev.sh restart

dev-logs:
	./scripts/dev.sh logs

dev-status:
	./scripts/dev.sh status

dev-app:
	./scripts/dev.sh app

dev-frontend:
	./scripts/dev.sh frontend


