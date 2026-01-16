#!/bin/bash
# =============================================================================
# Deploy User API to Minikube
# Flow: Kong -> gRPC Gateway -> User Service -> MongoDB
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  Deploying User API to Minikube"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if minikube is running
if ! minikube status > /dev/null 2>&1; then
    echo -e "${RED}Error: Minikube is not running${NC}"
    echo "Start minikube with: minikube start"
    exit 1
fi

# Use minikube's docker daemon
echo -e "${YELLOW}Setting up Docker environment...${NC}"
eval $(minikube docker-env)

# =============================================================================
# Step 1: Build User Service Image
# =============================================================================
echo ""
echo -e "${GREEN}Step 1: Building User Service image...${NC}"
cd "$PROJECT_ROOT"
docker build -t user-service:v2 -f service/user-service/Dockerfile .

# =============================================================================
# Step 2: Build gRPC Gateway Image
# =============================================================================
echo ""
echo -e "${GREEN}Step 2: Building gRPC Gateway image...${NC}"
docker build -t grpc-gateway:v6 -f api-gateway/grpc-gateway/Dockerfile .

# =============================================================================
# Step 3: Deploy User Service
# =============================================================================
echo ""
echo -e "${GREEN}Step 3: Deploying User Service...${NC}"

# Update Helm dependencies
cd "$PROJECT_ROOT/apps/user-service"
helm dependency update

# Deploy or upgrade user-service
helm upgrade --install user-service . \
    -n dev \
    --create-namespace \
    -f values-minikube.yaml \
    --wait

# =============================================================================
# Step 4: Deploy gRPC Gateway
# =============================================================================
echo ""
echo -e "${GREEN}Step 4: Deploying gRPC Gateway...${NC}"

# Update image tag in deployment.yaml
cd "$PROJECT_ROOT/api-gateway/grpc-gateway"
sed -i 's/grpc-gateway:v[0-9]*/grpc-gateway:v6/g' deployment.yaml

kubectl apply -f deployment.yaml

# Wait for deployment
kubectl rollout status deployment/grpc-gateway -n kong --timeout=120s

# =============================================================================
# Step 5: Apply Kong Ingress
# =============================================================================
echo ""
echo -e "${GREEN}Step 5: Applying Kong Ingress...${NC}"
kubectl apply -f "$PROJECT_ROOT/charts/platform/kong/templates/ingress.yaml"

# =============================================================================
# Step 6: Get Service URLs
# =============================================================================
echo ""
echo "=========================================="
echo -e "${GREEN}  Deployment Complete!${NC}"
echo "=========================================="

# Get minikube IP
MINIKUBE_IP=$(minikube ip)
KONG_PORT=30080

echo ""
echo -e "${YELLOW}API Endpoints:${NC}"
echo "  Base URL: http://${MINIKUBE_IP}:${KONG_PORT}"
echo ""
echo "  Auth Endpoints:"
echo "    POST /v1/auth/register  - Create new user"
echo "    POST /v1/auth/login     - Login with email/password"
echo "    POST /v1/auth/refresh   - Refresh access token"
echo "    POST /v1/auth/logout    - Logout"
echo ""
echo "  User Endpoints:"
echo "    GET  /v1/users          - List users"
echo "    GET  /v1/users/{id}     - Get user by ID"
echo "    GET  /v1/users/me       - Get current user"
echo "    PATCH /v1/users/{id}    - Update user"
echo "    DELETE /v1/users/{id}   - Delete user"
echo ""
echo -e "${YELLOW}Quick Test:${NC}"
echo "  curl http://${MINIKUBE_IP}:${KONG_PORT}/healthz"
echo ""
echo -e "${YELLOW}Register a User:${NC}"
echo "  curl -X POST http://${MINIKUBE_IP}:${KONG_PORT}/v1/auth/register \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"tenant_id\":\"tenant-1\",\"email\":\"test@example.com\",\"password\":\"Test@123456\",\"first_name\":\"Test\",\"last_name\":\"User\"}'"
echo ""
echo -e "${YELLOW}Check Pods:${NC}"
echo "  kubectl get pods -n dev"
echo "  kubectl get pods -n kong"
echo ""
