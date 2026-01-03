# Monitoring Stack Deployment Guide

## Components

### Monitoring (namespace: monitoring)
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert management
- **Node Exporter**: Node metrics
- **Kube State Metrics**: Kubernetes metrics

### Logging (namespace: logging)
- **Loki**: Log aggregation
- **Promtail**: Log collection agent

## Quick Start

### Prerequisites
- Kubernetes cluster running (minikube, kind, EKS, etc.)
- kubectl configured
- Helm 3.x installed

### Deploy

**Linux/Mac:**
```bash
chmod +x scripts/deploy-monitoring.sh
./scripts/deploy-monitoring.sh
```

**Windows PowerShell:**
```powershell
.\scripts\deploy-monitoring.ps1
```

## Manual Deployment

### 1. Add Helm Repositories
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

### 2. Deploy Logging Stack
```bash
helm upgrade --install logging ./charts/platform/logging \
  --namespace logging \
  --create-namespace \
  --wait
```

### 3. Deploy Monitoring Stack
```bash
helm upgrade --install monitoring ./charts/platform/monitoring \
  --namespace monitoring \
  --create-namespace \
  --wait
```

## Access Services

### Grafana
```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-grafana 3000:80
```
- URL: http://localhost:3000
- Username: `admin`
- Password: `prom-operator`

### Prometheus
```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```
- URL: http://localhost:9090

### Loki
```bash
kubectl port-forward -n logging svc/logging-loki 3100:3100
```
- URL: http://localhost:3100

## Verify Installation

### Check Pods
```bash
# Monitoring namespace
kubectl get pods -n monitoring

# Logging namespace
kubectl get pods -n logging
```

### Check Services
```bash
# Monitoring services
kubectl get svc -n monitoring

# Logging services
kubectl get svc -n logging
```

## Configuration

### Grafana Datasources
Grafana is automatically configured with:
- **Prometheus** - Default datasource for metrics
- **Loki** - For logs (auto-discovered via ConfigMap)

### Storage
All components use persistent volumes:
- Prometheus: 10Gi
- Grafana: 10Gi
- Loki: 10Gi
- Alertmanager: 5Gi

### Resource Limits
All components have resource requests and limits configured for production use.

## Troubleshooting

### Check Logs
```bash
# Grafana logs
kubectl logs -n monitoring -l app.kubernetes.io/name=grafana

# Prometheus logs
kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus

# Loki logs
kubectl logs -n logging -l app=loki

# Promtail logs
kubectl logs -n logging -l app=promtail
```

### Common Issues

**Pods in Pending state:**
- Check if PersistentVolumes can be provisioned
- Verify storage class exists: `kubectl get storageclass`

**Grafana can't connect to Loki:**
- Verify Loki service is running: `kubectl get svc -n logging`
- Check namespace/service name in datasource config

**Out of resources:**
- Reduce resource requests in values.yaml
- Scale down replicas if needed

## Uninstall

```bash
helm uninstall monitoring -n monitoring
helm uninstall logging -n logging
kubectl delete namespace monitoring
kubectl delete namespace logging
```

## Custom Configuration

### Override Values

Create a custom values file:

**monitoring-custom.yaml:**
```yaml
kube-prometheus-stack:
  grafana:
    adminPassword: your-secure-password
    persistence:
      size: 20Gi
```

Deploy with custom values:
```bash
helm upgrade --install monitoring ./charts/platform/monitoring \
  -f monitoring-custom.yaml \
  --namespace monitoring
```

### Add Custom Dashboards

Create a ConfigMap with label `grafana_dashboard: "1"`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  dashboard.json: |
    { ... dashboard JSON ... }
```

Grafana sidecar will automatically load it.

## Monitoring Your Applications

To enable monitoring for your services:

1. Add ServiceMonitor to your service
2. Ensure service has the correct labels
3. Prometheus will auto-discover and scrape metrics

Example ServiceMonitor in [charts/microservice/templates/servicemonitor.yaml](../charts/microservice/templates/servicemonitor.yaml)
