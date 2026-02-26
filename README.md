# Task Management Platform — Backend

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?style=for-the-badge&logo=go" />
  <img src="https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=node.js" />
  <img src="https://img.shields.io/badge/NestJS-10-E0234E?style=for-the-badge&logo=nestjs" />
  <img src="https://img.shields.io/badge/Kubernetes-EKS-326CE5?style=for-the-badge&logo=kubernetes" />
  <img src="https://img.shields.io/badge/Terraform-IaC-7B42BC?style=for-the-badge&logo=terraform" />
</p>

<p align="center">
  A production-grade, multi-tenant task management backend built with a <strong>microservices architecture</strong>.<br/>
  Designed for scalability, observability, and clean separation of concerns using <strong>DDD</strong>, <strong>CQRS</strong>, and <strong>Hexagonal Architecture</strong>.
</p>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Infrastructure](#infrastructure)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [CI/CD Pipeline](#cicd-pipeline)
- [Observability](#observability)

---

## Overview

This platform provides a robust backend for managing tasks, projects, and teams across multiple tenants. It supports real-time notifications, role-based access control (RBAC), and a fully event-driven architecture using Kafka.

**Key capabilities:**
- 🏢 **Multi-tenancy** — strict tenant isolation at every layer
- ⚡ **Event-driven** — async communication via Apache Kafka
- 🔐 **Zero-trust security** — JWT authentication enforced at the API Gateway (Kong)
- 📊 **Full observability** — distributed tracing, metrics, and structured logs
- ☁️ **Cloud-native** — deployed on AWS EKS with Terraform-managed infrastructure

---

## Architecture

```
                         ┌─────────────────────────────┐
  Client (Web / Mobile)  │       Kong API Gateway        │
  ─────────────────────► │  • JWT Authentication (AuthN) │
                         │  • Rate Limiting              │
                         │  • Route to BFF / Services    │
                         └──────────────┬────────────────┘
                                        │
                         ┌──────────────▼────────────────┐
                         │         BFF Service            │
                         │  (NestJS + GraphQL Gateway)    │
                         │  • Aggregates API responses    │
                         │  • gRPC fan-out               │
                         └──────┬──────────────┬──────────┘
                                │ gRPC          │ gRPC
               ┌────────────────▼─┐          ┌─▼────────────────┐
               │   User Service   │          │   Task Service   │
               │   (NestJS/TS)    │          │     (Go)         │
               │  • Auth / RBAC   │          │  • Tasks/Comments │
               │  • User CRUD     │          │  • Projects/Spaces │
               │  • JWT tokens    │          │  • Dependencies  │
               └────────┬─────────┘          └────────┬─────────┘
                        │                             │
                        └──────────┬──────────────────┘
                                   │  Kafka Events
                         ┌─────────▼──────────────────┐
                         │    Notification Service     │
                         │          (Go)               │
                         │  • Email / Push / In-App    │
                         │  • Consumes domain events   │
                         └────────────────────────────┘
```

**Communication patterns:**
- **Synchronous**: Client ↔ BFF via GraphQL/HTTP; BFF ↔ Services via gRPC
- **Asynchronous**: Services publish domain events to Kafka; Notification Service consumes them

---

## Services

### 🔵 User Service — `service/user-service` (NestJS / TypeScript)

Core identity and access management service.

| Capability | Details |
|---|---|
| **Architecture** | DDD + CQRS + Hexagonal (Ports & Adapters) |
| **Transport** | gRPC (protobuf) |
| **Database** | MongoDB (domain store) + PostgreSQL (read model via TypeORM) |
| **Cache** | Redis (JWT refresh tokens, session cache) |
| **Features** | Register, Login, OAuth2, RBAC (Role/Permission assignment), Tenant management |
| **Events emitted** | `UserCreated`, `UserLoggedIn`, `UserPasswordChanged`, `UserDeleted` |

### 🟢 Task Service — `service/task-service` (Go / Kratos)

Core business logic for task and project management.

| Capability | Details |
|---|---|
| **Architecture** | DDD + CQRS + Clean Architecture |
| **Transport** | gRPC (protobuf) + HTTP (metrics) |
| **Database** | MongoDB |
| **Cache** | Redis |
| **Messaging** | Kafka (producer) + Outbox pattern for reliable event delivery |
| **Tracing** | OpenTelemetry → Tempo |
| **Features** | Task CRUD, sub-tasks, comments, priorities, due dates, assignees, watchers, custom fields, time tracking, dependencies, tags |
| **Events emitted** | `TaskCreated`, `TaskAssigned`, `TaskStatusChanged`, `TaskCommented` |

**Task entity fields:**
- `Status`: `open` → `in_progress` → `complete` / `closed`
- `Priority`: `urgent`, `high`, `normal`, `low`
- Multi-assignee, watcher list, parent task (sub-task support)
- `TimeEstimateMinutes`, `TimeTrackedMinutes`
- `CustomFields` (`map[string]string`)

### 🟡 Notification Service — `service/notification-service` (Go / Kratos)

Event-driven notification dispatcher.

| Capability | Details |
|---|---|
| **Transport** | Kafka consumer (triggers), HTTP (metrics) |
| **Delivery channels** | Email (SMTP), Push (FCM/APNs), In-App |
| **Resilience** | Redis-backed delivery status, retry logic, circuit breaker |
| **Templates** | Dynamic Golang templates per notification type |

### 🟠 BFF Service — `service/bff-service` (NestJS / TypeScript)

Backend-for-Frontend: GraphQL API gateway that aggregates responses from downstream gRPC services.

| Capability | Details |
|---|---|
| **Protocol** | GraphQL (Apollo) |
| **Upstreams** | User Service + Task Service via gRPC |
| **Cache** | Redis (query caching) |
| **Auth** | Validates Kong-injected JWT headers (`x-user-id`, `x-tenant-id`, `x-roles`) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Languages** | Go 1.24, TypeScript / Node.js 20 |
| **Go Framework** | [Kratos v2](https://go-kratos.dev/) (gRPC + HTTP, config, DI) |
| **Node Framework** | NestJS 10 (CQRS module, gRPC transport, GraphQL) |
| **API Gateway** | Kong (JWT plugin, rate limiting, routing) |
| **Messaging** | Apache Kafka (`segmentio/kafka-go`) |
| **Databases** | MongoDB, PostgreSQL |
| **Cache** | Redis |
| **Service Contract** | Protobuf + gRPC |
| **Tracing** | OpenTelemetry SDK → OTLP → Grafana Tempo |
| **Metrics** | Prometheus client → Grafana dashboards |
| **Logging** | Loki + Promtail (structured logs) |
| **DI / Wiring** | Google Wire (Go services) |
| **Containerization** | Docker (multi-stage builds) |
| **Orchestration** | Kubernetes (AWS EKS) |
| **IaC** | Terraform |
| **GitOps** | ArgoCD |
| **CI/CD** | Jenkins + GitHub Actions |
| **Helm Charts** | Custom charts per service + platform umbrella chart |

---

## Infrastructure

Managed entirely with **Terraform** and deployed on **AWS EKS**.

```
terraform/
├── modules/
│   ├── eks/          # EKS cluster + managed node groups
│   ├── ecr/          # Elastic Container Registry per service
│   ├── network/      # VPC, subnets, security groups
│   ├── security/     # IAM roles, policies
│   ├── argocd/       # ArgoCD GitOps setup
│   ├── jenkins/      # Jenkins CI server
│   └── platform/     # Kong, Kafka, monitoring stack
└── environments/
    ├── dev/
    └── staging/
```

**Platform components (Helm charts):**

| Component | Purpose |
|---|---|
| **Kong** | API Gateway + NLB ingress |
| **Kafka** | Event bus (Strimzi / bitnami) |
| **ArgoCD** | GitOps continuous delivery |
| **Jenkins** | CI pipeline runner |
| **Prometheus + Grafana** | Metrics & dashboards |
| **Loki + Promtail** | Log aggregation |
| **Grafana Tempo** | Distributed tracing |

---

## Project Structure

```
.
├── service/
│   ├── task-service/          # Go — Task domain service
│   │   ├── internal/
│   │   │   ├── domain/        # Entities, Value Objects, Domain Events
│   │   │   ├── application/   # Commands, Queries, Event Handlers, Ports
│   │   │   ├── adapter/       # Persistence (MongoDB), Messaging (Kafka), External
│   │   │   └── server/        # gRPC + HTTP server bootstrap
│   │   └── cmd/               # Entrypoints (Wire DI)
│   │
│   ├── notification-service/  # Go — Notification dispatcher
│   │   ├── internal/
│   │   │   ├── domain/        # Notification, Template entities
│   │   │   ├── app/           # Application use-cases
│   │   │   ├── infrastructure/ # Kafka consumer, Redis, Email/Push/In-App senders
│   │   │   └── ports/         # Interface definitions
│   │   └── cmd/
│   │
│   ├── user-service/          # NestJS — Identity & access service
│   │   └── src/
│   │       ├── application/   # CQRS Commands + Queries + Ports
│   │       ├── domain/        # Aggregates, Value Objects, Domain Events
│   │       └── infrastructure/ # gRPC controllers, DB repositories, Redis
│   │
│   └── bff-service/           # NestJS — GraphQL BFF gateway
│       └── src/
│
├── packages/
│   ├── proto/                 # Shared Protobuf definitions (user, task, common)
│   └── shared/go/             # Shared Go library (go-shared module)
│
├── charts/                    # Helm charts
│   ├── microservice/          # Generic microservice chart
│   └── platform/              # Infrastructure charts (Kong, Kafka, monitoring…)
│
├── terraform/                 # Infrastructure as Code (AWS)
├── environments/              # Environment-specific configs
├── scripts/                   # Utility scripts (release, setup, CI helpers)
├── docker-compose.yml         # Local service builds
└── Makefile                   # Developer shortcuts
```

---

## Getting Started

### Prerequisites

- Go 1.24+
- Node.js 20+
- Docker & Docker Compose
- kubectl, helm, terraform (for infrastructure)

### Build all services locally

```bash
# Build all Docker images
docker-compose build --parallel

# Build a specific service
docker-compose build task-service
```

### Run individual services (development)

```bash
# Task Service (Go)
cd service/task-service
cp .env.example .env
make run

# User Service (NestJS)
cd service/user-service
cp .env.example .env
npm install && npm run start:dev

# Notification Service (Go)
cd service/notification-service
cp .env..example .env
make run

# BFF Service (NestJS / GraphQL)
cd service/bff-service
cp .env.example .env
npm install && npm run start:dev
```

### Infrastructure (AWS EKS)

```bash
# Initialize and deploy to dev
make tf-init ENV=dev
make tf-plan ENV=dev
make tf-apply ENV=dev

# Configure kubectl
make k8s-config ENV=dev

# Deploy all Helm charts
make helm-deploy-all ENV=dev

# Or full deployment in one command
make deploy ENV=dev
```

See [`/deploy-eks`](.agent/workflows/deploy-eks.md) workflow for the step-by-step guide.

---

## CI/CD Pipeline

### GitHub Actions

| Workflow | Trigger | Description |
|---|---|---|
| `ci.yaml` | Push / PR | Build, lint, test all services |
| `deploy-platform.yaml` | Manual | Deploy platform infra (Kong, Kafka, monitoring) |
| `deploy-eks.yaml` | Manual / tag | Build images → push to ECR → deploy via Helm |
| `release.yaml` | Git tag push | Semantic version build + GitHub Release creation |

### Release

```powershell
# Bump patch version (e.g. 1.0.0 → 1.0.1)
.\scripts\release.ps1 -Bump patch

# Bump minor version
.\scripts\release.ps1 -Bump minor

# Dry-run (no push)
.\scripts\release.ps1 -Bump patch -DryRun
```

The release pipeline builds Docker images tagged as `1.0.0`, `1.0`, `1`, and `latest`, deploys to EKS, and creates a GitHub Release with auto-generated changelog.

---

## Observability

| Signal | Tool | Access |
|---|---|---|
| **Metrics** | Prometheus + Grafana | `make port-forward-grafana` → `localhost:3000` |
| **Traces** | OpenTelemetry → Grafana Tempo | `make port-forward-jaeger` → `localhost:16686` |
| **Logs** | Loki + Promtail | `make port-forward-loki` → `localhost:3100` |

All Go services instrument their MongoDB, Kafka, and gRPC calls with OpenTelemetry spans via `otelmongo` and manual span creation.

---

## Makefile Reference

```bash
make help                    # Show all available commands
make deploy ENV=dev          # Full Terraform + Helm deploy
make tf-plan ENV=dev         # Preview Terraform changes
make helm-deploy-all ENV=dev # Deploy all Helm charts
make logs SERVICE=task-service ENV=dev  # Tail service logs
make validate                # Validate Terraform + Helm configs
make format                  # Auto-format Terraform files
make clean                   # Remove temporary build artifacts
```

---

<p align="center">Built with ❤️ using Go, NestJS, Kubernetes, and Terraform</p>
