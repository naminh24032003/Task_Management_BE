#!/bin/bash
# =============================================================================
# Redis Cluster Deployment Script for Minikube
# =============================================================================

set -e

echo "🚀 Starting Redis Cluster deployment on Minikube..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Change to terraform directory
cd "$(dirname "$0")/../../terraform/environments/minikube"

# Check if Minikube is running
echo "📋 Checking Minikube status..."
if ! minikube status > /dev/null 2>&1; then
    echo -e "${RED}❌ Minikube is not running!${NC}"
    echo "Please start Minikube first: minikube start --cpus=6 --memory=12288"
    exit 1
fi
echo -e "${GREEN}✅ Minikube is running${NC}"
echo ""

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    echo -e "${YELLOW}⚠️  terraform.tfvars not found, copying from example...${NC}"
    cp terraform.tfvars.example terraform.tfvars
    echo -e "${GREEN}✅ Created terraform.tfvars${NC}"
fi

# Check if secrets.auto.tfvars exists
if [ ! -f "secrets.auto.tfvars" ]; then
    echo -e "${YELLOW}⚠️  secrets.auto.tfvars not found, copying from example...${NC}"
    cp secrets.auto.tfvars.example secrets.auto.tfvars
    echo -e "${YELLOW}⚠️  Please edit secrets.auto.tfvars and set secure passwords!${NC}"
    echo ""
fi

# Enable Redis in terraform.tfvars if not already enabled
if ! grep -q "redis_enabled.*=.*true" terraform.tfvars; then
    echo -e "${YELLOW}📝 Enabling Redis in terraform.tfvars...${NC}"

    # Check if redis_enabled line exists
    if grep -q "redis_enabled" terraform.tfvars; then
        # Update existing line
        sed -i 's/redis_enabled.*=.*/redis_enabled = true/' terraform.tfvars
    else
        # Add new line
        echo "" >> terraform.tfvars
        echo "# Redis Configuration" >> terraform.tfvars
        echo "redis_enabled = true" >> terraform.tfvars
    fi

    echo -e "${GREEN}✅ Redis enabled${NC}"
fi
echo ""

# Initialize Terraform
echo "🔧 Initializing Terraform..."
terraform init -upgrade > /dev/null 2>&1
echo -e "${GREEN}✅ Terraform initialized${NC}"
echo ""

# Plan
echo "📋 Planning Terraform changes..."
terraform plan -out=tfplan > /dev/null 2>&1
echo ""

# Apply
echo "🚀 Deploying Redis Cluster..."
echo -e "${YELLOW}This will create 6 Redis nodes (3 masters + 3 replicas)${NC}"
read -p "Continue with deployment? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

terraform apply tfplan
echo -e "${GREEN}✅ Redis Cluster deployed successfully!${NC}"
echo ""

# Wait for pods to be ready
echo "⏳ Waiting for Redis pods to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=redis-cluster -n redis --timeout=300s 2>/dev/null || true
echo ""

# Show deployment status
echo "📊 Redis Cluster Deployment Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl get pods -n redis
echo ""
kubectl get svc -n redis
echo ""

# Get Redis connection info
echo "🔌 Redis Connection Information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
terraform output redis 2>/dev/null || echo "Run 'terraform output redis' to see connection details"
echo ""

# Show cluster info
echo "📊 Redis Cluster Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REDIS_POD=$(kubectl get pod -n redis -l app.kubernetes.io/name=redis-cluster -o jsonpath='{.items[0].metadata.name}')
if [ ! -z "$REDIS_POD" ]; then
    echo "Getting cluster info from pod: $REDIS_POD"
    kubectl exec -n redis $REDIS_POD -- redis-cli -c -a redis-secret-password CLUSTER INFO 2>/dev/null | grep -E "cluster_state|cluster_slots|cluster_known_nodes|cluster_size" || true
fi
echo ""

# Next steps
echo "📝 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Test Redis: ./scripts/redis/test-redis.sh"
echo "2. Connect to Redis CLI: ./scripts/redis/redis-cli.sh"
echo "3. Check REDIS_QUICKSTART.md for usage examples"
echo "4. Integrate with your services"
echo ""

echo -e "${GREEN}🎉 Redis Cluster is ready to use!${NC}"
echo ""
echo "Connection details:"
echo "  Host: redis-cluster.redis.svc.cluster.local"
echo "  Port: 6379"
echo "  Password: (check secrets.auto.tfvars)"
