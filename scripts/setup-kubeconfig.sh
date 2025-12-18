#!/bin/bash

# Setup kubeconfig for EKS cluster
# Usage: ./setup-kubeconfig.sh <environment>

set -e

ENVIRONMENT=$1
TERRAFORM_DIR="./terraform/environments/${ENVIRONMENT}"

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo "Error: Invalid environment. Use 'dev', 'staging', or 'production'"
    exit 1
fi

echo "Setting up kubeconfig for ${ENVIRONMENT} environment..."

cd "$TERRAFORM_DIR"
CLUSTER_NAME=$(terraform output -raw eks_cluster_name)
REGION=$(terraform output -raw aws_region 2>/dev/null || echo "us-east-1")
cd - > /dev/null

aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$REGION"

echo "✓ Kubeconfig configured for cluster: $CLUSTER_NAME"
echo ""
echo "Test connection:"
echo "  kubectl get nodes"
echo "  kubectl get pods --all-namespaces"
