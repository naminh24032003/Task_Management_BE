# Logging Stack Helm Chart

This chart deploys Loki and Promtail for log aggregation in Kubernetes.

## Components

- **Loki**: Log aggregation system
- **Promtail**: Log collection agent that ships logs to Loki

## Installation

### Add Helm Repository
```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

### Install Chart
```bash
helm upgrade --install logging . \
  --namespace logging \
  --create-namespace
```

## Configuration

Key configuration options in `values.yaml`:

### Loki Configuration
- **Persistence**: Enabled with 10Gi storage
- **Retention**: Configurable via schema_config
- **Storage**: BoltDB Shipper with filesystem backend

### Promtail Configuration
- **Auto-discovery**: Automatically discovers pods and collects logs
- **Client URL**: Configured to send logs to Loki

## Accessing Loki

Port-forward the service:
```bash
kubectl port-forward -n logging svc/logging-loki 3100:3100
```

Query logs using LogQL:
```bash
curl -G -s "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query={app="my-app"}' | jq
```

## Integration with Grafana

This chart creates a ConfigMap with label `grafana_datasource: "1"` that will be automatically discovered by Grafana if the sidecar is enabled.

The datasource points to: `http://logging-loki:3100`

## Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `loki-stack.loki.enabled` | Enable Loki | `true` |
| `loki-stack.loki.persistence.enabled` | Enable persistence | `true` |
| `loki-stack.loki.persistence.size` | Storage size | `10Gi` |
| `loki-stack.promtail.enabled` | Enable Promtail | `true` |

## Troubleshooting

### View Loki logs
```bash
kubectl logs -n logging -l app=loki
```

### View Promtail logs
```bash
kubectl logs -n logging -l app=promtail
```

### Check if logs are being ingested
```bash
# Port-forward first
kubectl port-forward -n logging svc/logging-loki 3100:3100

# Query recent logs
curl -G -s "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query={namespace="default"}' \
  --data-urlencode 'limit=10' | jq
```

## Uninstall

```bash
helm uninstall logging -n logging
kubectl delete namespace logging
```
