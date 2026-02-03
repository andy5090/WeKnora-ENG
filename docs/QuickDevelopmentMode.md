# Quick Development Mode Guide

Solves the issue in the development workflow where you need to build Docker images every time you modify `app` (backend) or `frontend` code, enabling hot updates for these two modules.


## Usage Methods

### Method 1: Using Make Commands (Recommended)

```bash
# Terminal 1: Start infrastructure
make dev-start

# Terminal 2: Start backend
make dev-app

# Terminal 3: Start frontend
make dev-frontend
```

### Method 2: Using Development Scripts

```bash
# Terminal 1
./scripts/dev.sh start

# Terminal 2
./scripts/dev.sh app

# Terminal 3
./scripts/dev.sh frontend
```

### Method 3: One-Click Start (Interactive)

```bash
./scripts/quick-dev.sh
```



### Using Air for Backend Hot Reload

After installing Air, backend code changes will automatically recompile and restart:

```bash
# Install Air
go install github.com/cosmtrek/air@latest

# Ensure it's in PATH
export PATH=$PATH:$(go env GOPATH)/bin

# Start with Air (auto-detected)
make dev-app
```


## Architecture Overview

### Development Mode Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Local Development Environment           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐         ┌──────────┐                     │
│  │ Backend  │◄────────┤ Frontend │                     │
│  │  (local) │         │  (local) │                     │
│  │  :8080   │         │  :5173   │                     │
│  └────┬─────┘         └──────────┘                     │
│       │                                                 │
│       │ Connect to infrastructure services              │
│       ▼                                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │      Docker Infrastructure Containers            │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ PostgreSQL │ Redis │ MinIO │ Neo4j │ DocReader │   │
│  │   :5432    │ :6379 │ :9000 │ :7687 │  :50051   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Production Mode Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Docker Compose Environment               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐         ┌──────────┐                     │
│  │ Backend  │◄────────┤ Frontend │                     │
│  │(container)│         │(container)│                     │
│  │  :8080   │         │   :80    │                     │
│  └────┬─────┘         └──────────┘                     │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Infrastructure Containers                │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ PostgreSQL │ Redis │ MinIO │ Neo4j │ DocReader │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
