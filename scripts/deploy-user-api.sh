#!/bin/bash
# =============================================================================
# Deploy User API to Minikube
# Flow: Kong -> BFF (GraphQL) -> User Service -> MongoDB
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
# Step 2: Build BFF Service Image
# =============================================================================
echo ""
echo -e "${GREEN}Step 2: Building BFF Service image...${NC}"
docker build -t bff-service:v1 -f service/bff-service/Dockerfile .

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
# Step 4: Deploy BFF Service
# =============================================================================
echo ""
echo -e "${GREEN}Step 4: Deploying BFF Service...${NC}"

cd "$PROJECT_ROOT/apps/bff-service"
helm dependency update

helm upgrade --install bff-service . \
    -n dev \
    -f values-minikube.yaml \
    --wait

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
echo "  GraphQL Endpoint (BFF):"
echo "    POST /graphql  - GraphQL API"
echo ""
echo "  BFF Health Check:"
echo "    GET /bff/health  - Health check"
echo ""
echo -e "${YELLOW}Quick Test:${NC}"
echo "  curl http://${MINIKUBE_IP}:${KONG_PORT}/bff/health"
echo ""
echo -e "${YELLOW}GraphQL Introspection:${NC}"
echo "  curl -X POST http://${MINIKUBE_IP}:${KONG_PORT}/graphql \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"query\": \"{ __schema { types { name } } }\"}'"
echo ""
echo -e "${YELLOW}Register a User:${NC}"
echo "  curl -X POST http://${MINIKUBE_IP}:${KONG_PORT}/graphql \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"query\": \"mutation { register(input: { tenantId: \\\"tenant-1\\\", email: \\\"test@example.com\\\", password: \\\"Test@123456\\\", firstName: \\\"Test\\\", lastName: \\\"User\\\" }) { accessToken refreshToken } }\"}'"
echo ""
echo -e "${YELLOW}Check Pods:${NC}"
echo "  kubectl get pods -n dev"
echo "  kubectl get pods -n kong"
echo ""
