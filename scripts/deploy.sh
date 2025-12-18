#!/bin/bash

# Deploy Task Management Platform
# Usage: ./deploy.sh <environment> [options]

set -e

ENVIRONMENT=$1
NAMESPACE="${ENVIRONMENT:-dev}"
TERRAFORM_DIR="./terraform/environments/${ENVIRONMENT}"
HELM_DIR="./helm-charts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Task Management Platform Deployment${NC}"
echo -e "${GREEN}Environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}========================================${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid environment. Use 'dev', 'staging', or 'production'${NC}"
    exit 1
fi

# Step 1: Terraform Infrastructure
echo -e "\n${YELLOW}Step 1: Deploying Infrastructure with Terraform...${NC}"
cd "$TERRAFORM_DIR"

terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Get outputs
EKS_CLUSTER_NAME=$(terraform output -raw eks_cluster_name)
echo -e "${GREEN}✓ Infrastructure deployed successfully${NC}"

cd - > /dev/null

# Step 2: Configure kubectl
echo -e "\n${YELLOW}Step 2: Configuring kubectl...${NC}"
aws eks update-kubeconfig --name "$EKS_CLUSTER_NAME" --region us-east-1
echo -e "${GREEN}✓ kubectl configured${NC}"

# Step 3: Create namespace
echo -e "\n${YELLOW}Step 3: Creating Kubernetes namespace...${NC}"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓ Namespace created: ${NAMESPACE}${NC}"

# Step 4: Deploy Helm Charts
echo -e "\n${YELLOW}Step 4: Deploying Helm charts...${NC}"

# Deploy infrastructure chart
echo "Deploying infrastructure components..."
helm upgrade --install infrastructure "${HELM_DIR}/charts/infrastructure" \
    -f "${HELM_DIR}/charts/infrastructure/values/values-${ENVIRONMENT}.yaml" \
    -n "$NAMESPACE" \
    --wait \
    --timeout 10m

# Deploy observability chart
echo "Deploying observability stack..."
helm upgrade --install observability "${HELM_DIR}/charts/observability" \
    -n "$NAMESPACE" \
    --wait \
    --timeout 10m

# Deploy microservices
echo "Deploying task-service..."
helm upgrade --install task-service "${HELM_DIR}/services/task-service" \
    -f "${HELM_DIR}/services/task-service/values/values-${ENVIRONMENT}.yaml" \
    -n "$NAMESPACE" \
    --wait

echo "Deploying user-service..."
helm upgrade --install user-service "${HELM_DIR}/services/user-service" \
    -f "${HELM_DIR}/services/user-service/values/values-${ENVIRONMENT}.yaml" \
    -n "$NAMESPACE" \
    --wait

echo -e "${GREEN}✓ Helm charts deployed successfully${NC}"

# Step 5: Verify deployment
echo -e "\n${YELLOW}Step 5: Verifying deployment...${NC}"
kubectl get pods -n "$NAMESPACE"
kubectl get svc -n "$NAMESPACE"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\nAccess services:"
echo -e "  Prometheus: kubectl port-forward -n ${NAMESPACE} svc/observability-prometheus 9090:9090"
echo -e "  Grafana:    kubectl port-forward -n ${NAMESPACE} svc/observability-grafana 3000:3000"
echo -e "  Jaeger:     kubectl port-forward -n ${NAMESPACE} svc/observability-jaeger 16686:16686"
