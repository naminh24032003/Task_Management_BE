#!/usr/bin/env pwsh
# resume-cluster.ps1 — Scale nodes back up and restore all services
#
# Usage: .\scripts\resume-cluster.ps1

$REGION = "ap-southeast-1"
$CLUSTER = "task-management-dev"
$GENERAL_NG = "task-management-dev-general"
$PLATFORM_NG = "task-management-dev-platform"
$GENERAL_ASG = "eks-task-management-dev-general-0ace4847-d167-92f6-60e5-addc50b84809"
$PLATFORM_ASG = "eks-task-management-dev-platform-28ce4847-f2ca-8bb6-c0df-6eb51e1d1f20"

Write-Host "=== RESUMING CLUSTER: $CLUSTER ===" -ForegroundColor Green

# Step 1: Scale nodes back up
Write-Host "[1/4] Scaling nodes back up..." -ForegroundColor White
aws autoscaling update-auto-scaling-group --region $REGION `
    --auto-scaling-group-name $GENERAL_ASG `
    --min-size 1 --max-size 3 --desired-capacity 2 | Out-Null

aws autoscaling update-auto-scaling-group --region $REGION `
    --auto-scaling-group-name $PLATFORM_ASG `
    --min-size 1 --max-size 2 --desired-capacity 1 | Out-Null

aws eks update-nodegroup-config --cluster-name $CLUSTER --region $REGION `
    --nodegroup-name $GENERAL_NG `
    --scaling-config minSize=1,maxSize=3,desiredSize=2 | Out-Null

aws eks update-nodegroup-config --cluster-name $CLUSTER --region $REGION `
    --nodegroup-name $PLATFORM_NG `
    --scaling-config minSize=1,maxSize=2,desiredSize=1 | Out-Null

Write-Host "  Nodes scaling up — waiting 3 minutes for Ready state..." -ForegroundColor Yellow
Start-Sleep -Seconds 180

# Step 2: Wait for nodes
Write-Host "[2/4] Checking node status..." -ForegroundColor White
kubectl get nodes
Start-Sleep -Seconds 30

# Step 3: Scale up stateful services first
Write-Host "[3/4] Restoring stateful services..." -ForegroundColor White
kubectl scale statefulset --all -n redis --replicas=3
kubectl scale deployment -n dev mongodb --replicas=1
kubectl scale deployment -n kafka kafka --replicas=1 2>$null
Start-Sleep -Seconds 20

# Step 4: Restore all other services
Write-Host "[4/4] Restoring application services and observability..." -ForegroundColor White
kubectl scale deployment --all -n dev --replicas=1
kubectl scale deployment --all -n monitoring --replicas=1
kubectl scale statefulset --all -n monitoring --replicas=1
kubectl scale statefulset --all -n logging --replicas=1
kubectl scale statefulset --all -n tracing --replicas=1

# External secrets will re-sync automatically
Write-Host ""
Write-Host "=== FINAL STATUS ===" -ForegroundColor Yellow
Start-Sleep -Seconds 30
kubectl get pods -n dev
Write-Host ""
kubectl get nodes
Write-Host ""
Write-Host "✅ Cluster resumed. ExternalSecrets will auto-sync secrets." -ForegroundColor Green
Write-Host "   If pods are still Pending, wait another 2-3 min for nodes to fully register." -ForegroundColor White
