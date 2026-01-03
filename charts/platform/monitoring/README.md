# Monitoring Stack Helm Chart

This chart deploys the kube-prometheus-stack which includes Prometheus, Grafana, Alertmanager, and related monitoring components.

## Components

- **Prometheus**: Metrics collection and storage
- **Grafana**: Metrics visualization and dashboards  
- **Alertmanager**: Alert routing and management
- **Node Exporter**: Hardware and OS metrics
- **Kube State Metrics**: Kubernetes object metrics
- **Prometheus Operator**: Manages Prometheus instances

## Installation

### Add Helm Repository
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

### Install Chart
```bash
helm upgrade --install monitoring . \
  --namespace monitoring \
  --create-namespace
```

## Configuration

Key configuration in `values.yaml`:

### Prometheus
- **Storage**: 10Gi persistent volume
- **ServiceMonitor Discovery**: Enabled across all namespaces
- **Resources**: CPU and memory limits configured

### Grafana
- **Admin Password**: `prom-operator` (change in production!)
- **Persistence**: 10Gi for dashboards and config
- **Sidecar**: Auto-discovery of dashboards and datasources
- **Default Datasources**: Prometheus (builtin) + Loki (from logging chart)

### Alertmanager
- **Storage**: 5Gi persistent volume
- **Enabled**: true

## Accessing Services

### Grafana Dashboard
```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-grafana 3000:80
```
- URL: http://localhost:3000
- Username: `admin`  
- Password: `prom-operator`

### Prometheus UI
```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```
- URL: http://localhost:9090

### Alertmanager UI
```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-alertmanager 9093:9093
```
- URL: http://localhost:9093

## Adding Custom Dashboards

Create a ConfigMap with label `grafana_dashboard: "1"`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-custom-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  my-dashboard.json: |
    {
      "dashboard": { ... },
      "overwrite": true
    }
```

Grafana will automatically detect and load the dashboard.

## Monitoring Custom Services

To monitor your application, create a ServiceMonitor:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app
  namespace: default
  labels:
    release: monitoring
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

## Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `kube-prometheus-stack.prometheus.enabled` | Enable Prometheus | `true` |
| `kube-prometheus-stack.grafana.enabled` | Enable Grafana | `true` |
| `kube-prometheus-stack.grafana.adminPassword` | Grafana admin password | `prom-operator` |
| `kube-prometheus-stack.alertmanager.enabled` | Enable Alertmanager | `true` |
| `kube-prometheus-stack.nodeExporter.enabled` | Enable Node Exporter | `true` |

## Datasource Integration

This chart includes a Loki datasource configuration that points to the logging chart's Loki instance at:
```
http://logging-loki.logging.svc.cluster.local:3100
```

Make sure to deploy the logging chart first or adjust this URL.

## Troubleshooting

### Check Prometheus Targets
```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```
Visit http://localhost:9090/targets

### View Grafana Logs
```bash
kubectl logs -n monitoring -l app.kubernetes.io/name=grafana
```

### Check ServiceMonitors
```bash
kubectl get servicemonitors -A
```

### Verify Prometheus Configuration
```bash
kubectl get prometheus -n monitoring -o yaml
```

## Security Considerations

⚠️ **Important for Production:**

1. Change default Grafana password:
```yaml
kube-prometheus-stack:
  grafana:
    adminPassword: "your-secure-password"
```

2. Enable ingress with TLS:
```yaml
kube-prometheus-stack:
  grafana:
    ingress:
      enabled: true
      hosts:
        - grafana.yourdomain.com
      tls:
        - secretName: grafana-tls
          hosts:
            - grafana.yourdomain.com
```

## Uninstall

```bash
helm uninstall monitoring -n monitoring
kubectl delete namespace monitoring
```

## Resources

- [kube-prometheus-stack Documentation](https://github.com/prometheus-operator/kube-prometheus)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
