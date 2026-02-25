#!/bin/bash
# =============================================================================
# EKS Full Deployment Script
# =============================================================================
# Usage:
#   ./scripts/eks-deploy.sh                  # Deploy everything (infra + services)
#   ./scripts/eks-deploy.sh --infra-only     # Only provision infrastructure
#   ./scripts/eks-deploy.sh --services-only  # Only build & deploy services
#   ./scripts/eks-deploy.sh --service user-service  # Deploy a single service
# =============================================================================

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
EKS_CLUSTER="${EKS_CLUSTER:-task-management-dev}"
NAMESPACE="${NAMESPACE:-dev}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
TF_DIR="terraform/environments/dev"
CHART_DIR="charts/microservice"
SERVICES=("user-service" "task-service" "notification-service" "bff-service")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()    { echo -e "${BLUE}[INFO]${NC} $*"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
success(){ echo -e "${GREEN}[OK]${NC} $*"; }

# ─── Argument Parsing ────────────────────────────────────────────────────────
INFRA_ONLY=false
SERVICES_ONLY=false
SINGLE_SERVICE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --infra-only)    INFRA_ONLY=true; shift ;;
    --services-only) SERVICES_ONLY=true; shift ;;
    --service)       SINGLE_SERVICE="$2"; shift 2 ;;
    --tag)           IMAGE_TAG="$2"; shift 2 ;;
    --region)        AWS_REGION="$2"; shift 2 ;;
    --namespace)     NAMESPACE="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--infra-only] [--services-only] [--service <name>] [--tag <tag>]"
      exit 0 ;;
    *) error "Unknown option: $1" ;;
  esac
done

# ─── Prerequisites Check ─────────────────────────────────────────────────────
check_prerequisites() {
  log "Checking prerequisites..."
  local missing=()
  command -v aws       >/dev/null 2>&1 || missing+=("aws-cli")
  command -v terraform >/dev/null 2>&1 || missing+=("terraform")
  command -v kubectl   >/dev/null 2>&1 || missing+=("kubectl")
  command -v helm      >/dev/null 2>&1 || missing+=("helm")
  command -v docker    >/dev/null 2>&1 || missing+=("docker")

  if [ ${#missing[@]} -gt 0 ]; then
    error "Missing tools: ${missing[*]}. Please install them first."
  fi

  # Verify AWS credentials
  AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) \
    || error "AWS credentials not configured. Run 'aws configure' first."

  ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  success "All prerequisites OK (AWS Account: ${AWS_ACCOUNT_ID})"
}

# ─── Step 1: Create S3 Backend (one-time) ─────────────────────────────────────
create_terraform_backend() {
  log "Checking Terraform backend (S3 + DynamoDB)..."

  BUCKET_NAME="task-mgmt-tf-state-${AWS_ACCOUNT_ID:(-6)}"
  
  if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    success "S3 bucket '$BUCKET_NAME' already exists"
  else
    log "Creating S3 bucket: $BUCKET_NAME"
    aws s3 mb "s3://${BUCKET_NAME}" --region "$AWS_REGION"
    aws s3api put-bucket-versioning \
      --bucket "$BUCKET_NAME" \
      --versioning-configuration Status=Enabled
    success "S3 backend bucket created"
  fi

  TABLE_NAME="task-mgmt-tf-locks"
  if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    success "DynamoDB table '$TABLE_NAME' already exists"
  else
    log "Creating DynamoDB lock table: $TABLE_NAME"
    aws dynamodb create-table \
      --table-name "$TABLE_NAME" \
      --attribute-definitions AttributeName=LockID,AttributeType=S \
      --key-schema AttributeName=LockID,KeyType=HASH \
      --billing-mode PAY_PER_REQUEST \
      --region "$AWS_REGION"
    success "DynamoDB lock table created"
  fi
}

# ─── Step 2: Provision EKS Infrastructure ────────────────────────────────────
provision_infrastructure() {
  log "═══════════════════════════════════════════════════"
  log "  STEP 2: Provisioning EKS Infrastructure"
  log "═══════════════════════════════════════════════════"

  cd "$TF_DIR"

  log "Initializing Terraform..."
  terraform init

  log "Planning infrastructure..."
  terraform plan -out=tfplan

  echo ""
  echo -e "${YELLOW}Review the plan above. Continue? (y/N)${NC}"
  read -r confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    warn "Aborted by user."
    exit 0
  fi

  log "Applying infrastructure..."
  terraform apply tfplan

  success "Infrastructure provisioned!"

  # Print outputs
  terraform output

  # Return to project root
  cd - >/dev/null
}

# ─── Step 3: Configure kubectl ───────────────────────────────────────────────
configure_kubectl() {
  log "Configuring kubectl for EKS cluster: $EKS_CLUSTER"
  aws eks update-kubeconfig --region "$AWS_REGION" --name "$EKS_CLUSTER"
  
  # Verify connection
  kubectl cluster-info >/dev/null 2>&1 \
    || error "Cannot connect to EKS cluster"

  # Create namespace
  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

  success "kubectl configured and connected"
  kubectl get nodes
}

# ─── Step 4: Create ECR Repositories ────────────────────────────────────────
ensure_ecr_repos() {
  log "Ensuring ECR repositories exist..."
  for svc in "${SERVICES[@]}"; do
    REPO_NAME="task-management/${svc}"
    if aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
      success "  ECR repo '$REPO_NAME' exists"
    else
      log "  Creating ECR repo: $REPO_NAME"
      aws ecr create-repository \
        --repository-name "$REPO_NAME" \
        --region "$AWS_REGION" \
        --image-scanning-configuration scanOnPush=true
      success "  ECR repo '$REPO_NAME' created"
    fi
  done
}

# ─── Step 5: Login to ECR ───────────────────────────────────────────────────
ecr_login() {
  log "Logging in to ECR..."
  aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "$ECR_REGISTRY"
  success "Logged in to ECR: $ECR_REGISTRY"
}

# ─── Step 6: Build & Push Docker Images ─────────────────────────────────────
build_and_push() {
  local svc=$1
  log "Building and pushing: $svc (tag: $IMAGE_TAG)"

  case "$svc" in
    user-service|bff-service)
      docker build \
        -t "${ECR_REGISTRY}/task-management/${svc}:${IMAGE_TAG}" \
        -t "${ECR_REGISTRY}/task-management/${svc}:latest" \
        -f "service/${svc}/Dockerfile" \
        .
      ;;
    task-service|notification-service)
      docker build \
        -t "${ECR_REGISTRY}/task-management/${svc}:${IMAGE_TAG}" \
        -t "${ECR_REGISTRY}/task-management/${svc}:latest" \
        -f "service/${svc}/Dockerfile" \
        .
      ;;
    *)
      error "Unknown service: $svc"
      ;;
  esac

  docker push "${ECR_REGISTRY}/task-management/${svc}:${IMAGE_TAG}"
  docker push "${ECR_REGISTRY}/task-management/${svc}:latest"
  success "$svc pushed to ECR"
}

build_push_all() {
  log "═══════════════════════════════════════════════════"
  log "  STEP 6: Building & Pushing Docker Images"
  log "═══════════════════════════════════════════════════"

  ecr_login

  if [ -n "$SINGLE_SERVICE" ]; then
    build_and_push "$SINGLE_SERVICE"
  else
    for svc in "${SERVICES[@]}"; do
      build_and_push "$svc"
    done
  fi

  success "All images pushed to ECR"
}

# ─── Step 7: Deploy via Helm ────────────────────────────────────────────────
deploy_service() {
  local svc=$1
  log "Deploying $svc to EKS (namespace: $NAMESPACE)..."

  helm upgrade --install "$svc" "./${CHART_DIR}" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --values "apps/${svc}/values-eks.yaml" \
    --set "microservice.image.repository=${ECR_REGISTRY}/task-management/${svc}" \
    --set "microservice.image.tag=${IMAGE_TAG}" \
    --timeout 5m \
    --wait \
    --atomic

  # Verify
  kubectl rollout status "deployment/${svc}" -n "$NAMESPACE" --timeout=300s
  success "$svc deployed and healthy"
}

deploy_all() {
  log "═══════════════════════════════════════════════════"
  log "  STEP 7: Deploying Services to EKS"
  log "═══════════════════════════════════════════════════"

  if [ -n "$SINGLE_SERVICE" ]; then
    deploy_service "$SINGLE_SERVICE"
  else
    for svc in "${SERVICES[@]}"; do
      deploy_service "$svc"
    done
  fi
}

# ─── Step 8: Verify Deployment ──────────────────────────────────────────────
verify_deployment() {
  log "═══════════════════════════════════════════════════"
  log "  STEP 8: Verifying Deployment"
  log "═══════════════════════════════════════════════════"

  echo ""
  log "Deployments:"
  kubectl get deployments -n "$NAMESPACE"
  echo ""
  log "Pods:"
  kubectl get pods -n "$NAMESPACE"
  echo ""
  log "Services:"
  kubectl get svc -n "$NAMESPACE"
  echo ""

  # Check all pods are running
  NOT_RUNNING=$(kubectl get pods -n "$NAMESPACE" --no-headers | grep -v Running | grep -v Completed || true)
  if [ -n "$NOT_RUNNING" ]; then
    warn "Some pods are not running:"
    echo "$NOT_RUNNING"
  else
    success "All pods are running!"
  fi
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║    Task Management - EKS Deployment             ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  log "Region:    $AWS_REGION"
  log "Cluster:   $EKS_CLUSTER"
  log "Namespace: $NAMESPACE"
  log "Image Tag: $IMAGE_TAG"
  echo ""

  check_prerequisites

  if [ "$SERVICES_ONLY" = true ]; then
    configure_kubectl
    build_push_all
    deploy_all
    verify_deployment
  elif [ "$INFRA_ONLY" = true ]; then
    create_terraform_backend
    provision_infrastructure
    configure_kubectl
  else
    # Full deployment
    create_terraform_backend
    provision_infrastructure
    configure_kubectl
    ensure_ecr_repos
    build_push_all
    deploy_all
    verify_deployment
  fi

  echo ""
  success "═══════════════════════════════════════════════════"
  success "  Deployment complete!"
  success "═══════════════════════════════════════════════════"
}

main
