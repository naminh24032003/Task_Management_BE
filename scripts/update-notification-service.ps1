# Update notification-service
$ErrorActionPreference = "Stop"

$IMAGE_NAME = "notification-service"
$TAG = "v1"
$NAMESPACE = "dev"

Write-Host "🔨 Building ${IMAGE_NAME} Docker image..." -ForegroundColor Cyan
docker build -t "${IMAGE_NAME}:${TAG}" -f service/notification-service/Dockerfile .

Write-Host "📦 Loading image to minikube..." -ForegroundColor Yellow
minikube image load "${IMAGE_NAME}:${TAG}"

Write-Host "🔄 Updating Helm release..." -ForegroundColor Yellow
helm upgrade --install $IMAGE_NAME apps/notification-service -f apps/notification-service/values-minikube.yaml -n $NAMESPACE

Write-Host "🔄 Restarting deployment to ensure new image is used..." -ForegroundColor Yellow
kubectl rollout restart "deployment/${IMAGE_NAME}" -n $NAMESPACE

Write-Host "⏳ Waiting for deployment..." -ForegroundColor Yellow
kubectl rollout status "deployment/${IMAGE_NAME}" -n $NAMESPACE --timeout=120s

Write-Host ""
Write-Host "✅ ${IMAGE_NAME} updated!" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Check pod logs:" -ForegroundColor Cyan
Write-Host "   kubectl logs -n dev -l app.kubernetes.io/instance=notification-service -c microservice --tail=20" -ForegroundColor White
