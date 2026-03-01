#!/usr/bin/env pwsh
# pause-cluster.ps1 — Scale all nodes to 0 to stop EC2 charges
# Saves ~$2.83/day (nodes) but EKS control plane + NAT + EBS still charge ~$3.32/day
#
# Usage: .\scripts\pause-cluster.ps1
# Resume: .\scripts\resume-cluster.ps1

$REGION = "ap-southeast-1"
$CLUSTER = "task-management-dev"
$GENERAL_NG = "task-management-dev-general"
$PLATFORM_NG = "task-management-dev-platform"
$GENERAL_ASG = "eks-task-management-dev-general-0ace4847-d167-92f6-60e5-addc50b84809"
$PLATFORM_ASG = "eks-task-management-dev-platform-28ce4847-f2ca-8bb6-c0df-6eb51e1d1f20"

Write-Host "=== PAUSING CLUSTER: $CLUSTER ===" -ForegroundColor Yellow
Write-Host "This will save ~`$2.83/day (EC2 nodes)" -ForegroundColor Cyan
Write-Host "Remaining cost: ~`$3.32/day (EKS control plane + NAT + EBS)" -ForegroundColor Cyan
Write-Host ""

# Step 1: Scale down all deployments gracefully
Write-Host "[1/4] Scaling down all deployments in dev namespace..." -ForegroundColor White
kubectl scale deployment --all -n dev --replicas=0
kubectl scale deployment --all -n kafka --replicas=0 2>$null
kubectl scale statefulset --all -n redis --replicas=0 2>$null
kubectl scale statefulset --all -n logging --replicas=0 2>$null
kubectl scale statefulset --all -n tracing --replicas=0 2>$null
kubectl scale deployment --all -n monitoring --replicas=0 2>$null
kubectl scale statefulset --all -n monitoring --replicas=0 2>$null
Start-Sleep -Seconds 10

# Step 2: Update node group min to 0
Write-Host "[2/4] Updating node group minimums to 0..." -ForegroundColor White
aws eks update-nodegroup-config --cluster-name $CLUSTER --region $REGION `
    --nodegroup-name $GENERAL_NG `
    --scaling-config minSize=0,maxSize=3,desiredSize=0 | Out-Null

aws eks update-nodegroup-config --cluster-name $CLUSTER --region $REGION `
    --nodegroup-name $PLATFORM_NG `
    --scaling-config minSize=0,maxSize=2,desiredSize=0 | Out-Null

Write-Host "  Nodegroup scaling configs updated." -ForegroundColor Green

# Step 3: Scale ASGs to 0 immediately (don't wait for EKS)
Write-Host "[3/4] Scaling ASGs to 0..." -ForegroundColor White
aws autoscaling update-auto-scaling-group --region $REGION `
    --auto-scaling-group-name $GENERAL_ASG `
    --min-size 0 --max-size 3 --desired-capacity 0 | Out-Null

aws autoscaling update-auto-scaling-group --region $REGION `
    --auto-scaling-group-name $PLATFORM_ASG `
    --min-size 0 --max-size 2 --desired-capacity 0 | Out-Null

Write-Host "  ASGs scaled to 0." -ForegroundColor Green

# Step 4: Show status
Write-Host "[4/4] Waiting 30s for nodes to start terminating..." -ForegroundColor White
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "=== STATUS ===" -ForegroundColor Yellow
aws autoscaling describe-auto-scaling-groups --region $REGION `
    --auto-scaling-group-names $GENERAL_ASG $PLATFORM_ASG `
    --query "AutoScalingGroups[*].{Name:AutoScalingGroupName,Desired:DesiredCapacity,Min:MinSize}" `
    --output table

Write-Host ""
Write-Host "✅ Cluster pause initiated." -ForegroundColor Green
Write-Host "   EC2 nodes will terminate in ~2-3 minutes." -ForegroundColor White
Write-Host "   Remaining daily cost: ~`$3.32/day (control plane + NAT + EBS)" -ForegroundColor White
Write-Host "   To resume: .\scripts\resume-cluster.ps1" -ForegroundColor White
Write-Host "   To destroy fully (save `$3.32/day more): .\scripts\destroy-cluster.ps1" -ForegroundColor White
