# Deployment Guide

Complete guide for deploying the Task Management Platform to AWS EKS.

## Prerequisites

### Required Tools
- **AWS CLI** (v2.x): `aws --version`
- **Terraform** (v1.5+): `terraform version`
- **kubectl** (v1.28+): `kubectl version`
- **Helm** (v3.x): `helm version`
- **Docker**: `docker --version`
- **Git**: `git --version`

### AWS Account Setup
1. **Configure AWS CLI**:
   ```bash
   aws configure
   # Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output (json)
   ```

2. **Verify IAM Permissions**:
   - EKS full access
   - VPC full access
   - RDS full access
   - S3 full access
   - EC2 full access

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourorg/task_management_be.git
cd task_management_be
```

### 2. Set Environment Variables
```bash
# Set sensitive variables
export TF_VAR_db_password="YourSecurePassword123!"
export AWS_REGION="us-east-1"
```

### 3. Deploy Infrastructure (Terraform)
```bash
cd terraform/environments/dev

# Initialize Terraform
terraform init

# Review plan
terraform plan

# Apply changes
terraform apply

# Note the outputs
terraform output
```

### 4. Configure kubectl
```bash
# Run the setup script
../../../scripts/setup-kubeconfig.sh dev

# Verify connection
kubectl get nodes
```

### 5. Deploy Application (Helm)
```bash
cd ../../../

# Deploy using the automation script
./scripts/deploy.sh dev
```

## Detailed Deployment Steps

### Step 1: Terraform Infrastructure

#### Initialize Backend (First Time Only)
```bash
# Create S3 bucket for state
aws s3 mb s3://task-mgmt-dev-terraform-state --region us-east-1

# Create DynamoDB table for state locking
aws dynamodb create-table \
    --table-name task-mgmt-terraform-locks \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1
```

#### Deploy Infrastructure
```bash
cd terraform/environments/dev

# Initialize
terraform init

# Format and validate
terraform fmt
terraform validate

# Plan
terraform plan -out=tfplan

# Apply
terraform apply tfplan

# Get outputs
EKS_CLUSTER=$(terraform output -raw eks_cluster_name)
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
```

### Step 2: Configure Kubernetes Access

```bash
# Update kubeconfig
aws eks update-kubeconfig --name $EKS_CLUSTER --region us-east-1

# Verify access
kubectl get nodes
kubectl get namespaces
```

### Step 3: Deploy Helm Charts

#### Deploy Infrastructure Components
```bash
cd helm-charts

# Create namespace
kubectl create namespace dev

# Deploy infrastructure (Kong, Kafka, Redis, Consul)
helm install infrastructure ./charts/infrastructure \
    -f ./charts/infrastructure/values/values-dev.yaml \
    -n dev \
    --wait \
    --timeout 10m

# Verify
kubectl get pods -n dev -l app.kubernetes.io/instance=infrastructure
```

#### Deploy Observability Stack
```bash
# Deploy Prometheus, Grafana, Loki, Jaeger
helm install observability ./charts/observability \
    -n dev \
    --wait \
    --timeout 10m

# Verify
kubectl get pods -n dev -l app.kubernetes.io/instance=observability
```

#### Deploy Microservices
```bash
# Task Service
helm install task-service ./services/task-service \
    -f ./services/task-service/values/values-dev.yaml \
    -n dev \
    --wait

# User Service
helm install user-service ./services/user-service \
    -f ./services/user-service/values/values-dev.yaml \
    -n dev \
    --wait

# Verify all pods
kubectl get pods -n dev
```

### Step 4: Verify Deployment

```bash
# Check pod status
kubectl get pods -n dev

# Check services
kubectl get svc -n dev

# Check ingress
kubectl get ingress -n dev

# View logs
kubectl logs -f deployment/task-service-microservice -n dev
```

## Accessing Services

### Port Forwarding (Development)

```bash
# Prometheus
kubectl port-forward -n dev svc/observability-prometheus 9090:9090
# Access http://localhost:9090

# Grafana (Default: admin/admin)
kubectl port-forward -n dev svc/observability-grafana 3000:3000
# Access: http://localhost:3000

# Jaeger Tracing
kubectl port-forward -n dev svc/observability-jaeger 16686:16686
# Access: http://localhost:16686

# Kong Admin API
kubectl port-forward -n dev svc/infrastructure-kong-admin 8001:8001
# Access: http://localhost:8001

# Task Service API
kubectl port-forward -n dev svc/task-service-microservice 8080:8080
# Access: http://localhost:8080
```

### Load Balancer (Production)

```bash
# Get LoadBalancer URL
kubectl get svc -n production | grep LoadBalancer

# Access via DNS
# Set up Route53 record pointing to the LoadBalancer DNS
```

## Configuration

### Database Connection

Update Kubernetes secrets with RDS endpoint:

```bash
RDS_ENDPOINT=$(cd terraform/environments/dev && terraform output -raw rds_endpoint)

kubectl create secret generic db-credentials \
    --from-literal=host=${RDS_ENDPOINT} \
    --from-literal=username=admin \
    --from-literal=password=${DB_PASSWORD} \
    --from-literal=database=taskmanagement \
    -n dev
```

### Environment Variables

Edit service values files:
```yaml
# helm-charts/services/task-service/values/values-dev.yaml
microservice:
  env:
    - name: DB_HOST
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: host
    - name: REDIS_URL
      value: "infrastructure-redis:6379"
    - name: KAFKA_BROKERS
      value: "infrastructure-kafka-headless:9092"
```

## Monitoring Setup

### Configure Grafana Dashboards

1. **Access Grafana**:
   ```bash
   kubectl port-forward -n dev svc/observability-grafana 3000:3000
   ```

2. **Login**: admin / admin (change on first login)

3. **Add Prometheus Data Source**:
   - URL: `http://observability-prometheus:9090`
   - Save & Test

4. **Import Dashboards**:
   - Go to Dashboards → Import
   - Upload JSON files from `helm-charts/charts/observability/dashboards/`

### Configure Alerts

```yaml
# Create alert rules in Prometheus
# helm-charts/charts/observability/values.yaml
prometheus:
  alerting_rules:
    - name: high_error_rate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate detected"
```

## Scaling

### Manual Scaling

```bash
# Scale deployment
kubectl scale deployment task-service-microservice --replicas=5 -n dev

# Scale via Helm
helm upgrade task-service ./services/task-service \
    --set microservice.replicas=5 \
    -n dev
```

### Auto-Scaling

HPA is configured by default in production:

```bash
# Check HPA status
kubectl get hpa -n production

# Describe HPA
kubectl describe hpa task-service-microservice -n production
```

## Updating Deployments

### Application Updates

```bash
# Update Docker image tag
helm upgrade task-service ./services/task-service \
    --set microservice.image.tag=v1.2.0 \
    -n dev \
    --wait

# Rollback if needed
helm rollback task-service -n dev
```

### Infrastructure Updates

```bash
cd terraform/environments/dev

# Update .tf files
# Run plan
terraform plan

# Apply changes
terraform apply
```

## Backup & Recovery

### Database Backup

```bash
# Automated daily snapshots are enabled by default
# Manual snapshot:
aws rds create-db-snapshot \
    --db-instance-identifier task-mgmt-dev-db \
    --db-snapshot-identifier task-mgmt-dev-snapshot-$(date +%Y%m%d)
```

### Restore Database

```bash
aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier task-mgmt-dev-db-restored \
    --db-snapshot-identifier task-mgmt-dev-snapshot-20250118
```

### Application State

```bash
# Helm release history
helm history task-service -n dev

# Rollback to previous release
helm rollback task-service 2 -n dev
```

## Troubleshooting

### Common Issues

**Pod CrashLoopBackOff**:
```bash
# Check logs
kubectl logs <pod-name> -n dev --previous

# Describe pod
kubectl describe pod <pod-name> -n dev

# Check events
kubectl get events -n dev --sort-by='.lastTimestamp'
```

**Service Unavailable**:
```bash
# Check service endpoints
kubectl get endpoints -n dev

# Check pod labels
kubectl get pods --show-labels -n dev

# Test service DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup task-service-microservice.dev.svc.cluster.local
```

**Database Connection Issues**:
```bash
# Check secret
kubectl get secret db-credentials -n dev -o yaml

# Test connection from pod
kubectl exec -it <pod-name> -n dev -- sh
# Inside pod:
psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

**Helm Installation Fails**:
```bash
# Debug template rendering
helm template task-service ./services/task-service \
    -f ./services/task-service/values/values-dev.yaml \
    --debug

# Lint chart
helm lint ./services/task-service
```

## Security Checklist

- [ ] Rotate database passwords regularly
- [ ] Enable AWS GuardDuty
- [ ] Configure AWS WAF rules
- [ ] Set up VPC Flow Logs
- [ ] Enable EKS audit logging
- [ ] Configure Network Policies
- [ ] Use Pod Security Standards
- [ ] Scan images for vulnerabilities
- [ ] Enable AWS Config rules
- [ ] Set up CloudTrail

## Performance Tuning

### Database
- [ ] Enable connection pooling (PgBouncer)
- [ ] Configure read replicas
- [ ] Optimize slow queries
- [ ] Set appropriate work_mem and shared_buffers

### Application
- [ ] Enable Redis caching
- [ ] Configure HTTP/2
- [ ] Implement compression
- [ ] Use CDN for static assets

### Kubernetes
- [ ] Set resource requests/limits
- [ ] Configure pod topology spread
- [ ] Enable cluster autoscaler
- [ ] Use node affinity rules

## Next Steps

1. **Set up CI/CD**: See `.github/workflows/`
2. **Configure ArgoCD**: See `deployments/argocd/`
3. **Set up monitoring alerts**: Configure PagerDuty
4. **Enable HTTPS**: Configure cert-manager
5. **Set up DNS**: Configure Route53

## Support

- **Documentation**: `docs/`
- **Runbook**: `docs/runbook.md`
- **Architecture**: `docs/architecture.md`
