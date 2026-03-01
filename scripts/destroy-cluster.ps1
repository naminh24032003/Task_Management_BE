#!/usr/bin/env pwsh
# destroy-cluster.ps1 — FULL TEARDOWN: delete everything → $0/day
# ⚠️  WARNING: This deletes ALL data including MongoDB, Redis, Kafka PVCs
# ⚠️  Only run if you have backups or don't need the data
#
# Saves remaining $3.32/day (EKS control plane + NAT Gateway + EBS)
# To rebuild: run your Terraform + re-run CI/CD pipelines
#
# Usage: .\scripts\destroy-cluster.ps1

param(
    [switch]$Confirm
)

$REGION = "ap-southeast-1"
$CLUSTER = "task-management-dev"

if (-not $Confirm) {
    Write-Host "⚠️  WARNING: This will PERMANENTLY DELETE:" -ForegroundColor Red
    Write-Host "   - EKS cluster: $CLUSTER" -ForegroundColor Red
    Write-Host "   - All EBS volumes (MongoDB, Redis, Kafka, Prometheus, Loki, Tempo data)" -ForegroundColor Red
    Write-Host "   - NAT Gateway" -ForegroundColor Red
    Write-Host "   - All Kubernetes resources" -ForegroundColor Red
    Write-Host ""
    Write-Host "   KMS key, Secrets Manager, ECR images, IAM roles are KEPT" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run with -Confirm flag to proceed:" -ForegroundColor White
    Write-Host "  .\scripts\destroy-cluster.ps1 -Confirm" -ForegroundColor Cyan
    exit 0
}

Write-Host "=== FULL TEARDOWN: $CLUSTER ===" -ForegroundColor Red
Write-Host "Starting in 10 seconds... Ctrl+C to cancel" -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Step 1: Scale nodes down first (faster ELB cleanup)
Write-Host "[1/5] Scaling down nodes to trigger LB cleanup..." -ForegroundColor White
kubectl delete svc -n kong kong-kong-proxy 2>$null
Start-Sleep -Seconds 30

# Step 2: Delete EKS node groups
Write-Host "[2/5] Deleting node groups..." -ForegroundColor White
aws eks delete-nodegroup --cluster-name $CLUSTER --region $REGION `
    --nodegroup-name "task-management-dev-general" 2>$null
aws eks delete-nodegroup --cluster-name $CLUSTER --region $REGION `
    --nodegroup-name "task-management-dev-platform" 2>$null

Write-Host "  Waiting for node groups to delete (~5 min)..." -ForegroundColor Yellow
aws eks wait nodegroup-deleted --cluster-name $CLUSTER --region $REGION `
    --nodegroup-name "task-management-dev-general" 2>$null
aws eks wait nodegroup-deleted --cluster-name $CLUSTER --region $REGION `
    --nodegroup-name "task-management-dev-platform" 2>$null
Write-Host "  Node groups deleted." -ForegroundColor Green

# Step 3: Delete EKS cluster
Write-Host "[3/5] Deleting EKS cluster..." -ForegroundColor White
aws eks delete-cluster --name $CLUSTER --region $REGION | Out-Null
aws eks wait cluster-deleted --name $CLUSTER --region $REGION
Write-Host "  EKS cluster deleted." -ForegroundColor Green

# Step 4: Delete NAT Gateway
Write-Host "[4/5] Deleting NAT Gateway..." -ForegroundColor White
$natId = aws ec2 describe-nat-gateways --region $REGION `
    --query "NatGateways[?State=='available'].NatGatewayId" --output text
if ($natId) {
    aws ec2 delete-nat-gateway --region $REGION --nat-gateway-id $natId | Out-Null
    Write-Host "  NAT Gateway $natId deletion initiated." -ForegroundColor Green
}

# Step 5: Summary
Write-Host "[5/5] Done." -ForegroundColor Green
Write-Host ""
Write-Host "=== TEARDOWN COMPLETE ===" -ForegroundColor Green
Write-Host "   Daily cost: ~`$0/day" -ForegroundColor Green
Write-Host ""
Write-Host "   Still exists (no charge or minimal):" -ForegroundColor White
Write-Host "   - KMS CMK: alias/task-management" -ForegroundColor White
Write-Host "   - Secrets Manager: task-management/dev/* (4 secrets)" -ForegroundColor White
Write-Host "   - ECR repos: task-management/* (4 repos)" -ForegroundColor White
Write-Host "   - IAM roles/policies" -ForegroundColor White
Write-Host "   - EIP for NAT (release manually to avoid `$0.005/hr idle charge)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   To rebuild: run Terraform + GitHub Actions CI/CD" -ForegroundColor Cyan

# Remind about Elastic IP
Write-Host ""
Write-Host "⚠️  Release Elastic IP to avoid idle charge:" -ForegroundColor Yellow
$eips = aws ec2 describe-addresses --region $REGION `
    --query "Addresses[?AssociationId==null].{IP:PublicIp,AllocId:AllocationId}" `
    --output table 2>$null
if ($eips) { Write-Host $eips }
