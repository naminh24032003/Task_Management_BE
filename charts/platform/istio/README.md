# Istio Service Mesh Configuration

Helm chart để cấu hình Istio Service Mesh cho Task Management Platform.

## 📋 Tổng quan

Chart này triển khai các cấu hình Istio để:

| Step | Mô tả | Trạng thái |
|------|-------|-----------|
| 1️⃣ | Cài Istio (profile demo hoặc minimal) | ✅ Script |
| 2️⃣ | Bật mesh cho namespace (istio-injection=enabled) | ✅ Template |
| 3️⃣ | Đưa service vào mesh (task, user, grpc-gateway) | ✅ Template |
| 4️⃣ | Kong KHÔNG inject sidecar | ✅ Template |
| 5️⃣ | Traffic Management (DestinationRule, VirtualService) | ✅ Template |
| 6️⃣ | Canary / Versioning (90/10 split) | ✅ Template |
| 7️⃣ | Resilience (Timeout, Retry, Circuit Breaker) | ✅ Template |
| 8️⃣ | Security (mTLS STRICT, AuthorizationPolicy) | ✅ Template |
| 9️⃣ | Observability (Tracing, Metrics) | ✅ Template |
| 🔟 | Test & Measure | ✅ Scripts |

## 📁 Cấu trúc

```
charts/platform/istio/
├── Chart.yaml
├── values.yaml
├── README.md
└── templates/
    ├── _helpers.tpl
    ├── namespace.yaml              # Step 2, 4
    ├── destination-rules.yaml      # Step 5, 6, 7
    ├── virtual-services.yaml       # Step 5, 6, 7
    ├── peer-authentication.yaml    # Step 8
    ├── authorization-policies.yaml # Step 8
    ├── telemetry.yaml             # Step 9
    └── service-entry.yaml         # External access
```

## 🚀 Cài đặt

### Prerequisites

1. **Kubernetes cluster** (minikube, EKS, AKS, GKE)
2. **istioctl** đã cài đặt
3. **Helm** v3+
4. **kubectl** configured

### Step 1: Cài Istio

```bash
# Download istioctl
curl -L https://istio.io/downloadIstio | sh -

# Install với profile demo (development)
istioctl install --set profile=demo -y

# Hoặc profile minimal (production)
istioctl install --set profile=minimal -y

# Verify
kubectl get pods -n istio-system
```

### Step 2-9: Deploy Configuration

```bash
# Sử dụng script (recommended)
./scripts/deploy-istio.sh all

# Hoặc từng bước
./scripts/deploy-istio.sh install
./scripts/deploy-istio.sh enable-mesh
./scripts/deploy-istio.sh deploy-config
./scripts/deploy-istio.sh restart
./scripts/deploy-istio.sh verify

# Windows PowerShell
.\scripts\deploy-istio.ps1 -Action all
```

### Manual Installation

```bash
# Label namespace
kubectl label namespace dev istio-injection=enabled --overwrite

# Deploy Istio config
helm upgrade --install istio-config ./charts/platform/istio \
  --namespace dev \
  --create-namespace

# Restart deployments để inject sidecar
kubectl rollout restart deployment -n dev
```

## ⚙️ Cấu hình

### Bật Canary Deployment (90/10)

```yaml
# values.yaml hoặc --set
trafficManagement:
  canary:
    enabled: true
    v1Weight: 90
    v2Weight: 10
```

```bash
helm upgrade istio-config ./charts/platform/istio \
  --namespace dev \
  --set trafficManagement.canary.enabled=true \
  --set trafficManagement.canary.v1Weight=90 \
  --set trafficManagement.canary.v2Weight=10
```

### Thay đổi mTLS Mode

```bash
# STRICT - chỉ cho phép mTLS traffic
helm upgrade istio-config ./charts/platform/istio \
  --set security.mtls.mode=STRICT

# PERMISSIVE - cho phép cả plain text
helm upgrade istio-config ./charts/platform/istio \
  --set security.mtls.mode=PERMISSIVE
```

### Điều chỉnh Resilience

```yaml
resilience:
  timeout: 15s
  retries:
    attempts: 5
    perTryTimeout: 5s
  circuitBreaker:
    consecutiveErrors: 10
    baseEjectionTime: 60s
```

## 🔍 Verification

### Kiểm tra Sidecar Injection

```bash
# Xem containers trong pod
kubectl get pods -n dev -o=custom-columns='NAME:.metadata.name,CONTAINERS:.spec.containers[*].name'

# Output mong đợi: mỗi pod có istio-proxy
# task-service-xxx    task-service,istio-proxy
# user-service-xxx    user-service,istio-proxy
```

### Kiểm tra Istio Resources

```bash
kubectl get virtualservices -n dev
kubectl get destinationrules -n dev
kubectl get peerauthentications -n dev
kubectl get authorizationpolicies -n dev
```

### Kiểm tra mTLS

```bash
# Verify mTLS status
istioctl x authz check deploy/task-service -n dev

# Check certificate
istioctl proxy-config secret deploy/task-service -n dev
```

## 📊 Observability

### Prometheus Metrics

```bash
# Port forward
kubectl port-forward svc/prometheus -n istio-system 9090:9090

# Query istio_requests_total
# http://localhost:9090
```

Key metrics:
- `istio_requests_total` - Total requests
- `istio_request_duration_milliseconds` - Request latency
- `istio_tcp_connections_opened_total` - TCP connections

### Jaeger Tracing

```bash
kubectl port-forward svc/tracing -n istio-system 16686:80
# http://localhost:16686
```

### Kiali Dashboard

```bash
kubectl port-forward svc/kiali -n istio-system 20001:20001
# http://localhost:20001
```

### Grafana

```bash
kubectl port-forward svc/grafana -n istio-system 3000:3000
# http://localhost:3000
```

## 🧪 Testing

### Test Traffic Flow

```bash
# Call API qua Kong
curl -X GET http://localhost:8000/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN"

# Verify trong Jaeger có trace xuyên services
```

### Test mTLS Block

```bash
# Deploy pod không có sidecar
kubectl run test-pod --image=curlimages/curl -n default -- sleep 3600

# Try to call service trong mesh (should fail với STRICT mTLS)
kubectl exec -it test-pod -n default -- curl http://task-service.dev:8080/health
```

### Load Test

```bash
# Install hey (HTTP load generator)
# https://github.com/rakyll/hey

hey -n 10000 -c 100 http://localhost:8000/api/v1/tasks

# Check metrics
# - p95 latency
# - Error rate
# - Success rate
```

## 🛠️ Troubleshooting

### Pod không có sidecar

```bash
# Check namespace label
kubectl get ns dev --show-labels

# Ensure label exists
kubectl label ns dev istio-injection=enabled --overwrite

# Restart deployment
kubectl rollout restart deployment/task-service -n dev
```

### Connection refused

```bash
# Check DestinationRule
kubectl describe destinationrule task-service-destination -n dev

# Check endpoints
kubectl get endpoints task-service -n dev

# Check Envoy config
istioctl proxy-config cluster deploy/task-service -n dev
```

### mTLS Issues

```bash
# Check PeerAuthentication
kubectl get peerauthentication -n dev

# Temporarily set to PERMISSIVE for debugging
kubectl patch peerauthentication default-mtls -n dev \
  --type merge -p '{"spec":{"mtls":{"mode":"PERMISSIVE"}}}'
```

### View Envoy Logs

```bash
# Enable debug logging
istioctl proxy-config log deploy/task-service -n dev --level debug

# View logs
kubectl logs deploy/task-service -n dev -c istio-proxy
```

## 📚 Resources

- [Istio Documentation](https://istio.io/latest/docs/)
- [Traffic Management](https://istio.io/latest/docs/concepts/traffic-management/)
- [Security](https://istio.io/latest/docs/concepts/security/)
- [Observability](https://istio.io/latest/docs/concepts/observability/)
