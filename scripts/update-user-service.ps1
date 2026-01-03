# Update user-service with new metrics support

$ErrorActionPreference = "Stop"

Write-Host "🔨 Building user-service Docker image..." -ForegroundColor Cyan
docker build -t user-service:latest -f service/user-service/Dockerfile .

Write-Host "📦 Loading image to minikube..." -ForegroundColor Yellow
minikube image load user-service:latest

Write-Host "🔄 Restarting deployment..." -ForegroundColor Yellow
kubectl rollout restart deployment user-service -n default

Write-Host "⏳ Waiting for deployment..." -ForegroundColor Yellow
kubectl rollout status deployment user-service -n default --timeout=2m

Write-Host ""
Write-Host "✅ User-service updated!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Check Prometheus targets:" -ForegroundColor Cyan
Write-Host "   http://localhost:9091/targets" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Check pod logs:" -ForegroundColor Cyan
Write-Host "   kubectl logs -n default -l app=user-service --tail=20" -ForegroundColor White
