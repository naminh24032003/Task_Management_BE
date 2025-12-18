#!/bin/bash

# Destroy Task Management Platform
# Usage: ./destroy.sh <environment>

set -e

ENVIRONMENT=$1
NAMESPACE="${ENVIRONMENT:-dev}"
TERRAFORM_DIR="./terraform/environments/${ENVIRONMENT}"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}========================================${NC}"
echo -e "${RED}Task Management Platform Destruction${NC}"
echo -e "${RED}Environment: ${ENVIRONMENT}${NC}"
echo -e "${RED}========================================${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid environment${NC}"
    exit 1
fi

# Confirmation
read -p "Are you sure you want to destroy ${ENVIRONMENT} environment? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "Aborted."
    exit 0
fi

# Step 1: Delete Helm releases
echo -e "\n${YELLOW}Step 1: Deleting Helm releases...${NC}"
helm uninstall user-service -n "$NAMESPACE" --ignore-not-found
helm uninstall task-service -n "$NAMESPACE" --ignore-not-found
helm uninstall observability -n "$NAMESPACE" --ignore-not-found
helm uninstall infrastructure -n "$NAMESPACE" --ignore-not-found

# Step 2: Delete namespace
echo -e "\n${YELLOW}Step 2: Deleting namespace...${NC}"
kubectl delete namespace "$NAMESPACE" --ignore-not-found

# Step 3: Destroy Terraform infrastructure
echo -e "\n${YELLOW}Step 3: Destroying Terraform infrastructure...${NC}"
cd "$TERRAFORM_DIR"
terraform destroy -auto-approve
cd - > /dev/null

echo -e "\n${RED}Environment ${ENVIRONMENT} destroyed.${NC}"
