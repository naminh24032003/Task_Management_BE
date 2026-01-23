# Deploy Distributed Tracing Stack (Tempo + OpenTelemetry Collector)

$ErrorActionPreference = "Stop"

$NAMESPACE_TRACING = "tracing"

Write-Host "🚀 Deploying Distributed Tracing Stack..." -ForegroundColor Cyan

# Create namespace
Write-Host "📁 Creating namespace..." -ForegroundColor Yellow
kubectl create namespace $NAMESPACE_TRACING --dry-run=client -o yaml | kubectl apply -f -

# Add Helm repositories
Write-Host "📦 Adding Helm repositories..." -ForegroundColor Yellow
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Deploy Tempo
Write-Host "📊 Deploying Grafana Tempo..." -ForegroundColor Yellow
helm upgrade --install tempo grafana/tempo `
  --namespace $NAMESPACE_TRACING `
  --set tempo.receivers.otlp.protocols.grpc.endpoint="0.0.0.0:4317" `
  --set tempo.receivers.otlp.protocols.http.endpoint="0.0.0.0:4318" `
  --set persistence.enabled=true `
  --set persistence.size=5Gi `
  --wait `
  --timeout 5m

# Deploy OpenTelemetry Collector (optional, for more flexibility)
Write-Host "📡 Deploying OpenTelemetry Collector..." -ForegroundColor Yellow

# Create ConfigMap for OTEL Collector
$otelConfig = @"
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
  namespace: $NAMESPACE_TRACING
data:
  config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    
    processors:
      batch:
        timeout: 1s
        send_batch_size: 1024
      memory_limiter:
        check_interval: 1s
        limit_mib: 256
        spike_limit_mib: 50
    
    exporters:
      otlp:
        endpoint: tempo.$NAMESPACE_TRACING.svc.cluster.local:4317
        tls:
          insecure: true
      logging:
        loglevel: debug
    
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [otlp, logging]
"@

$otelConfig | kubectl apply -f -

# Deploy OTEL Collector
$otelDeployment = @"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
  namespace: $NAMESPACE_TRACING
spec:
  replicas: 1
  selector:
    matchLabels:
      app: otel-collector
  template:
    metadata:
      labels:
        app: otel-collector
    spec:
      containers:
        - name: otel-collector
          image: otel/opentelemetry-collector-contrib:0.91.0
          args:
            - --config=/conf/config.yaml
          ports:
            - containerPort: 4317
              name: otlp-grpc
            - containerPort: 4318
              name: otlp-http
          volumeMounts:
            - name: config
              mountPath: /conf
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
      volumes:
        - name: config
          configMap:
            name: otel-collector-config
---
apiVersion: v1
kind: Service
metadata:
  name: otel-collector
  namespace: $NAMESPACE_TRACING
spec:
  type: ClusterIP
  ports:
    - port: 4317
      targetPort: 4317
      name: otlp-grpc
    - port: 4318
      targetPort: 4318
      name: otlp-http
  selector:
    app: otel-collector
"@

$otelDeployment | kubectl apply -f -

Write-Host ""
Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Access Tempo:" -ForegroundColor Cyan
Write-Host "   kubectl port-forward -n $NAMESPACE_TRACING svc/tempo 3200:3200"
Write-Host "   URL: http://localhost:3200"
Write-Host ""
Write-Host "📡 OTEL Collector Endpoints:" -ForegroundColor Cyan
Write-Host "   gRPC: otel-collector.$NAMESPACE_TRACING.svc.cluster.local:4317"
Write-Host "   HTTP: otel-collector.$NAMESPACE_TRACING.svc.cluster.local:4318"
Write-Host ""
Write-Host "🔧 Configure your services with:" -ForegroundColor Yellow
Write-Host "   OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.$NAMESPACE_TRACING.svc.cluster.local:4317"
Write-Host ""
Write-Host "📋 To add Tempo as Grafana data source:" -ForegroundColor Cyan
Write-Host "   1. Open Grafana"
Write-Host "   2. Go to Configuration > Data Sources"
Write-Host "   3. Add 'Tempo' data source"
Write-Host "   4. Set URL: http://tempo.$NAMESPACE_TRACING.svc.cluster.local:3200"
Write-Host ""
Write-Host "🔍 Verify deployment:" -ForegroundColor Cyan
Write-Host "   kubectl get pods -n $NAMESPACE_TRACING"
Write-Host "   kubectl logs -n $NAMESPACE_TRACING -l app=otel-collector --tail=50"
