# Deploy Monitoring Stack (Prometheus + Grafana + Loki)

$ErrorActionPreference = "Stop"

$NAMESPACE_MONITORING = "monitoring"
$NAMESPACE_LOGGING = "logging"

Write-Host "🚀 Deploying Monitoring and Logging Stack..." -ForegroundColor Cyan

# Create namespaces
Write-Host "📁 Creating namespaces..." -ForegroundColor Yellow
kubectl create namespace $NAMESPACE_MONITORING --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace $NAMESPACE_LOGGING --dry-run=client -o yaml | kubectl apply -f -

# Add Helm repositories
Write-Host "📦 Adding Helm repositories..." -ForegroundColor Yellow
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Deploy Logging Stack (Loki + Promtail)
Write-Host "📊 Deploying Logging Stack..." -ForegroundColor Yellow
helm upgrade --install logging ./charts/platform/logging `
  --namespace $NAMESPACE_LOGGING `
  --create-namespace `
  --wait `
  --timeout 10m

# Deploy Monitoring Stack (Prometheus + Grafana + Alertmanager)
Write-Host "📈 Deploying Monitoring Stack..." -ForegroundColor Yellow
helm upgrade --install monitoring ./charts/platform/monitoring `
  --namespace $NAMESPACE_MONITORING `
  --create-namespace `
  --wait `
  --timeout 10m

Write-Host ""
Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Access Grafana:" -ForegroundColor Cyan
Write-Host "   kubectl port-forward -n $NAMESPACE_MONITORING svc/monitoring-kube-prometheus-grafana 3000:80"
Write-Host "   URL: http://localhost:3000"
Write-Host "   Username: admin"
Write-Host "   Password: prom-operator"
Write-Host ""
Write-Host "🔍 Access Prometheus:" -ForegroundColor Cyan
Write-Host "   kubectl port-forward -n $NAMESPACE_MONITORING svc/monitoring-kube-prometheus-prometheus 9090:9090"
Write-Host "   URL: http://localhost:9090"
Write-Host ""
Write-Host "📝 Access Loki:" -ForegroundColor Cyan
Write-Host "   kubectl port-forward -n $NAMESPACE_LOGGING svc/logging-loki 3100:3100"
Write-Host "   URL: http://localhost:3100"
Write-Host ""
Write-Host "🔎 View logs:" -ForegroundColor Cyan
Write-Host "   kubectl logs -n $NAMESPACE_MONITORING -l app.kubernetes.io/name=grafana --tail=100"
Write-Host "   kubectl logs -n $NAMESPACE_LOGGING -l app=loki --tail=100"
