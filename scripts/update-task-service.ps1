# Update task-service with ClickUp CRUD model
$ErrorActionPreference = "Stop"

$IMAGE_NAME = "task-service"
$TAG = "v2"
$NAMESPACE = "dev"

Write-Host "🔨 Building ${IMAGE_NAME} Docker image..." -ForegroundColor Cyan
docker build -t "${IMAGE_NAME}:${TAG}" -f service/task-service/Dockerfile .

Write-Host "📦 Loading image to minikube..." -ForegroundColor Yellow
minikube image load "${IMAGE_NAME}:${TAG}"

Write-Host "🔄 Patching deployment with new image..." -ForegroundColor Yellow
kubectl set image "deployment/${IMAGE_NAME}" "${IMAGE_NAME}=${IMAGE_NAME}:${TAG}" -n $NAMESPACE

Write-Host "🔄 Restarting deployment..." -ForegroundColor Yellow
kubectl rollout restart "deployment/${IMAGE_NAME}" -n $NAMESPACE

Write-Host "⏳ Waiting for deployment..." -ForegroundColor Yellow
kubectl rollout status "deployment/${IMAGE_NAME}" -n $NAMESPACE --timeout=120s

Write-Host ""
Write-Host "✅ ${IMAGE_NAME} updated!" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Check pod logs:" -ForegroundColor Cyan
Write-Host "   kubectl logs -n ${NAMESPACE} -l app=${IMAGE_NAME} --tail=20" -ForegroundColor White
