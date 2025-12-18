# Task Management Platform - Helm Charts

Complete Kubernetes deployment for Task Management Platform using Helm charts.

## Architecture Overview

This repository contains Helm charts for deploying a complete microservices-based task management platform with:

- **Infrastructure**: NGINX Ingress, Kong API Gateway, Kafka, Redis, Consul
- **Observability**: Prometheus, Grafana, Loki, Promtail, Jaeger, Sentry
- **Microservices**: Task Service, User Service (+ placeholders for Project, Notification, Auth)

## Directory Structure

```
helm-charts/
├── charts/                          # Reusable chart components
│   ├── infrastructure/              # Infrastructure components
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   ├── templates/
│   │   │   ├── nginx-ingress/      # NGINX Ingress Controller
│   │   │   ├── kong/               # Kong API Gateway
│   │   │   ├── kafka/              # Kafka Message Broker
│   │   │   ├── redis/              # Redis Cache
│   │   │   └── consul/             # Consul Service Discovery
│   │   └── values/
│   │       ├── values-dev.yaml
│   │       ├── values-staging.yaml
│   │       └── values-prod.yaml
│   │
│   ├── observability/               # Monitoring & Logging
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   ├── templates/
│   │   │   ├── prometheus/         # Metrics collection
│   │   │   ├── grafana/            # Dashboards
│   │   │   ├── loki/               # Log aggregation
│   │   │   ├── promtail/           # Log collection
│   │   │   ├── jaeger/             # Distributed tracing
│   │   │   └── sentry/             # Error tracking
│   │   └── dashboards/
│   │
│   └── microservice/                # Reusable microservice template
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── deployment.yaml
│           ├── service.yaml
│           ├── hpa.yaml            # Auto-scaling
│           ├── pdb.yaml            # Disruption budget
│           ├── configmap.yaml
│           ├── secret.yaml
│           ├── servicemonitor.yaml # Prometheus integration
│           └── networkpolicy.yaml
│
├── services/                        # Service-specific configurations
│   ├── task-service/
│   ├── user-service/
│   ├── project-service/             # Placeholder
│   ├── notification-service/        # Placeholder
│   └── auth-service/                # Placeholder
│
└── umbrella-chart/                  # Deploy everything at once
    ├── Chart.yaml
    ├── values.yaml
    └── values/
        ├── values-dev.yaml
        ├── values-staging.yaml
        └── values-prod.yaml
```

## Prerequisites

- Kubernetes cluster (v1.24+)
- Helm 3.x installed
- kubectl configured to access your cluster

## Quick Start

### 1. Deploy Everything (Umbrella Chart)

**Development Environment:**
```powershell
# Create namespace
kubectl create namespace dev

# Deploy full stack
helm install task-platform helm-charts/umbrella-chart `
  -f helm-charts/umbrella-chart/values/values-dev.yaml `
  -n dev

# Verify deployment
kubectl get all -n dev
```

**Staging Environment:**
```powershell
kubectl create namespace staging

helm install task-platform helm-charts/umbrella-chart `
  -f helm-charts/umbrella-chart/values/values-staging.yaml `
  -n staging
```

**Production Environment:**
```powershell
kubectl create namespace prod

helm install task-platform helm-charts/umbrella-chart `
  -f helm-charts/umbrella-chart/values/values-prod.yaml `
  -n prod
```

### 2. Deploy Components Separately

**Infrastructure First:**
```powershell
helm install infra helm-charts/charts/infrastructure `
  -f helm-charts/charts/infrastructure/values/values-dev.yaml `
  -n dev
```

**Then Observability:**
```powershell
helm install observability helm-charts/charts/observability `
  -n dev
```

**Finally Services:**
```powershell
# Task Service
helm install task-service helm-charts/services/task-service `
  -f helm-charts/services/task-service/values/values-dev.yaml `
  -n dev

# User Service
helm install user-service helm-charts/services/user-service `
  -f helm-charts/services/user-service/values/values-dev.yaml `
  -n dev
```

## Accessing Services

After deployment, access services via:

**Kong Admin API:**
```powershell
kubectl port-forward -n dev svc/infrastructure-kong-admin 8001:8001
# Access: http://localhost:8001
```

**Prometheus:**
```powershell
kubectl port-forward -n dev svc/observability-prometheus 9090:9090
# Access: http://localhost:9090
```

**Grafana:**
```powershell
kubectl port-forward -n dev svc/observability-grafana 3000:3000
# Access: http://localhost:3000
# Default credentials: admin / admin
```

**Jaeger UI:**
```powershell
kubectl port-forward -n dev svc/observability-jaeger 16686:16686
# Access: http://localhost:16686
```

## Upgrading Deployments

**Update a specific service:**
```powershell
helm upgrade task-service helm-charts/services/task-service `
  -f helm-charts/services/task-service/values/values-dev.yaml `
  -n dev
```

**Update entire platform:**
```powershell
helm upgrade task-platform helm-charts/umbrella-chart `
  -f helm-charts/umbrella-chart/values/values-dev.yaml `
  -n dev
```

## Uninstalling

**Remove specific chart:**
```powershell
helm uninstall task-service -n dev
```

**Remove entire platform:**
```powershell
helm uninstall task-platform -n dev
```

## Customization

### Modifying Resources

Edit the appropriate values file for your environment:

```yaml
# Example: helm-charts/services/task-service/values/values-dev.yaml
microservice:
  replicas: 3  # Change replica count
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
```

### Adding Environment Variables

```yaml
microservice:
  env:
    - name: MY_CUSTOM_VAR
      value: "custom-value"
```

### Enabling/Disabling Components

In umbrella chart values:

```yaml
infrastructure:
  enabled: true
  kafka:
    enabled: false  # Disable Kafka if not needed

observability:
  enabled: true
  sentry:
    enabled: false  # Disable Sentry in dev

services:
  projectService:
    enabled: false  # Placeholder services disabled by default
```

## Monitoring & Observability

### Prometheus Metrics

All services are automatically configured for Prometheus scraping via annotations:

```yaml
prometheus.io/scrape: "true"
prometheus.io/path: "/metrics"
prometheus.io/port: "8080"
```

### Grafana Dashboards

Pre-configured datasources:
- **Prometheus**: Metrics visualization
- **Loki**: Log aggregation and querying

### Distributed Tracing

Jaeger is configured to collect traces from all microservices.

## Troubleshooting

### View Pod Logs
```powershell
kubectl logs -f deployment/task-service-microservice -n dev
```

### Check Pod Status
```powershell
kubectl get pods -n dev
kubectl describe pod <pod-name> -n dev
```

### Validate Helm Charts
```powershell
helm lint helm-charts/umbrella-chart
helm template test helm-charts/umbrella-chart -f helm-charts/umbrella-chart/values/values-dev.yaml
```

### Common Issues

**ImagePullBackOff:**
- Ensure image repositories and tags are correct in values files
- Check image pull secrets if using private registries

**CrashLoopBackOff:**
- Check pod logs for application errors
- Verify ConfigMap and Secret configurations
- Ensure health check endpoints are correct

**Service not accessible:**
- Verify Service and Ingress configurations
- Check NetworkPolicies if enabled
- Ensure Kong/NGINX routes are configured

## Environment-Specific Configurations

| Environment | Replicas | Resources | Auto-scaling | Retention |
|-------------|----------|-----------|--------------|-----------|
| **Dev**     | 1-2      | Minimal   | Disabled     | 3-7 days  |
| **Staging** | 2-3      | Moderate  | Enabled      | 7-15 days |
| **Prod**    | 3-5+     | High      | Enabled      | 15-30 days|

## Contributing

When adding new microservices:

1. Create service directory in `helm-charts/services/`
2. Add `Chart.yaml` with dependency on `microservice` template
3. Override values in service-specific `values.yaml`
4. Add environment-specific values files
5. Update umbrella chart dependencies

## License

MIT License

## Support

For issues and questions, please open an issue in the repository.
