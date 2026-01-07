#!/bin/bash
# =============================================================================
# Kafka Deployment Script for Minikube
# =============================================================================

set -e

echo "🚀 Starting Kafka deployment on Minikube..."
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

# Enable Kafka in terraform.tfvars if not already enabled
if ! grep -q "kafka_enabled.*=.*true" terraform.tfvars; then
    echo -e "${YELLOW}📝 Enabling Kafka in terraform.tfvars...${NC}"

    # Check if kafka_enabled line exists
    if grep -q "kafka_enabled" terraform.tfvars; then
        # Update existing line
        sed -i 's/kafka_enabled.*=.*/kafka_enabled = true/' terraform.tfvars
    else
        # Add new line
        echo "" >> terraform.tfvars
        echo "# Kafka Configuration" >> terraform.tfvars
        echo "kafka_enabled = true" >> terraform.tfvars
    fi

    echo -e "${GREEN}✅ Kafka enabled${NC}"
fi
echo ""

# Initialize Terraform
echo "🔧 Initializing Terraform..."
terraform init -upgrade
echo -e "${GREEN}✅ Terraform initialized${NC}"
echo ""

# Plan
echo "📋 Planning Terraform changes..."
terraform plan -out=tfplan
echo ""

# Apply
echo "🚀 Applying Terraform configuration..."
read -p "Apply changes? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

terraform apply tfplan
echo -e "${GREEN}✅ Kafka deployed successfully!${NC}"
echo ""

# Wait for pods to be ready
echo "⏳ Waiting for Kafka pods to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=kafka -n kafka --timeout=300s 2>/dev/null || true
kubectl wait --for=condition=ready pod -l app=kafka-ui -n kafka --timeout=120s 2>/dev/null || true
echo ""

# Show deployment status
echo "📊 Kafka Deployment Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl get pods -n kafka
echo ""
kubectl get svc -n kafka
echo ""

# Get Kafka connection info
echo "🔌 Kafka Connection Information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
terraform output kafka
echo ""

# Instructions for Kafka UI
echo "🎨 Access Kafka UI:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Run in a new terminal:"
echo -e "${GREEN}kubectl port-forward -n kafka svc/kafka-ui 8080:8080${NC}"
echo "Then open: http://localhost:8080"
echo ""

# Next steps
echo "📝 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Access Kafka UI to verify cluster health"
echo "2. Create topics using: ./scripts/kafka/create-topics.sh"
echo "3. Test Kafka: ./scripts/kafka/test-kafka.sh"
echo "4. Integrate with your services"
echo ""

echo -e "${GREEN}🎉 Kafka is ready to use!${NC}"
