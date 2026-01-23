# Deploy Complete Tracing Stack and Test Register User Flow
# This script deploys Tempo, OTEL Collector, and tests the register user mutation

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Complete Tracing Setup for Register User Flow..." -ForegroundColor Cyan
Write-Host ""

# ==============================================================================
# Step 1: Deploy Tracing Infrastructure
# ==============================================================================
Write-Host "📦 Step 1: Deploying Tracing Infrastructure..." -ForegroundColor Yellow

# Create namespace
kubectl create namespace tracing --dry-run=client -o yaml | kubectl apply -f -

# Add Grafana helm repo
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Deploy Tempo
Write-Host "   📊 Installing Grafana Tempo..." -ForegroundColor Gray
helm upgrade --install tempo grafana/tempo `
  --namespace tracing `
  --set persistence.enabled=false `
  --set tempo.metricsGenerator.enabled=true `
  --wait --timeout 3m

# Deploy OTEL Collector
Write-Host "   📡 Deploying OpenTelemetry Collector..." -ForegroundColor Gray

$otelConfigYaml = @"
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
  namespace: tracing
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
    
    exporters:
      otlp/tempo:
        endpoint: tempo.tracing.svc.cluster.local:4317
        tls:
          insecure: true
      logging:
        verbosity: detailed
    
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch]
          exporters: [otlp/tempo, logging]
"@

$otelConfigYaml | kubectl apply -f -

$otelDeploymentYaml = @"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
  namespace: tracing
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
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
      volumes:
        - name: config
          configMap:
            name: otel-collector-config
---
apiVersion: v1
kind: Service
metadata:
  name: otel-collector
  namespace: tracing
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

$otelDeploymentYaml | kubectl apply -f -

# Wait for deployments
Write-Host "   ⏳ Waiting for tracing pods to be ready..." -ForegroundColor Gray
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=tempo -n tracing --timeout=120s 2>$null
kubectl wait --for=condition=ready pod -l app=otel-collector -n tracing --timeout=120s 2>$null

Write-Host "   ✅ Tracing infrastructure deployed!" -ForegroundColor Green
Write-Host ""

# ==============================================================================
# Step 2: Configure Kong OpenTelemetry Plugin
# ==============================================================================
Write-Host "📦 Step 2: Configuring Kong OpenTelemetry Plugin..." -ForegroundColor Yellow

$kongPluginYaml = @"
apiVersion: configuration.konghq.com/v1
kind: KongClusterPlugin
metadata:
  name: global-opentelemetry
  annotations:
    kubernetes.io/ingress.class: kong
  labels:
    global: "true"
config:
  endpoint: "http://otel-collector.tracing.svc.cluster.local:4318/v1/traces"
  resource_attributes:
    service.name: kong-gateway
    deployment.environment: minikube
  header_type: w3c
  batch_span_count: 200
  batch_flush_delay: 3
plugin: opentelemetry
"@

$kongPluginYaml | kubectl apply -f -

Write-Host "   ✅ Kong OpenTelemetry plugin configured!" -ForegroundColor Green
Write-Host ""

# ==============================================================================
# Step 3: Display Status
# ==============================================================================
Write-Host "📊 Deployment Status:" -ForegroundColor Cyan
Write-Host ""
kubectl get pods -n tracing
Write-Host ""

# ==============================================================================
# Step 4: Port Forward Instructions
# ==============================================================================
Write-Host "🔗 Access Instructions:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Port-forward Tempo (trace query):" -ForegroundColor White
Write-Host "   kubectl port-forward -n tracing svc/tempo 3200:3200" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Port-forward Grafana (UI):" -ForegroundColor White  
Write-Host "   kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-grafana 3000:80" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Configure Grafana Tempo Data Source:" -ForegroundColor White
Write-Host "   - Open http://localhost:3000" -ForegroundColor Gray
Write-Host "   - Go to Configuration > Data Sources > Add Tempo" -ForegroundColor Gray
Write-Host "   - URL: http://tempo.tracing.svc.cluster.local:3200" -ForegroundColor Gray
Write-Host ""

# ==============================================================================
# Step 5: Test Register User (if services are running)
# ==============================================================================
Write-Host "🧪 Test Register User Flow:" -ForegroundColor Cyan
Write-Host ""
Write-Host "After rebuilding services with tracing enabled, test with:" -ForegroundColor White
Write-Host ""
Write-Host '  # GraphQL Mutation via BFF' -ForegroundColor Gray
Write-Host '  curl -X POST http://$(minikube ip):30080/graphql \' -ForegroundColor Gray
Write-Host '    -H "Content-Type: application/json" \' -ForegroundColor Gray
Write-Host '    -d '"'"'{"query": "mutation { register(email: \"test@example.com\", password: \"Password123!\", name: \"Test User\") { id email } }"}'"'"'' -ForegroundColor Gray
Write-Host ""
Write-Host "Then view traces in Grafana Tempo!" -ForegroundColor Green
Write-Host ""

Write-Host "✅ Setup complete!" -ForegroundColor Green
