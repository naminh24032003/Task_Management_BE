# =============================================================================
# EKS Full Deployment Script (PowerShell - Windows)
# =============================================================================
# Usage:
#   .\scripts\eks-deploy.ps1                           # Deploy everything
#   .\scripts\eks-deploy.ps1 -InfraOnly                # Only provision infra
#   .\scripts\eks-deploy.ps1 -ServicesOnly              # Only build & deploy services
#   .\scripts\eks-deploy.ps1 -SingleService user-service # Deploy single service
#   .\scripts\eks-deploy.ps1 -ImageTag v1.0.0           # Custom image tag
# =============================================================================

param(
    [switch]$InfraOnly,
    [switch]$ServicesOnly,
    [string]$SingleService = "",
    [string]$ImageTag = "",
    [string]$AwsRegion = "ap-southeast-1",
    [string]$EksCluster = "task-management-dev",
    [string]$Namespace = "dev"
)

$ErrorActionPreference = "Stop"

# ─── Configuration ───────────────────────────────────────────────────────────
if (-not $ImageTag) {
    $ImageTag = (git rev-parse --short HEAD).Trim()
}
$TfDir = "terraform\environments\dev"
$ChartDir = "charts/microservice"
$Services = @("user-service", "task-service", "notification-service", "bff-service")

# ─── Helper Functions ────────────────────────────────────────────────────────
function Write-Log   { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn  { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }
function Write-Ok    { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }

# ─── Step 1: Prerequisites ──────────────────────────────────────────────────
function Test-Prerequisites {
    Write-Log "Checking prerequisites..."
    $missing = @()
    @("aws", "terraform", "kubectl", "helm", "docker") | ForEach-Object {
        if (-not (Get-Command $_ -ErrorAction SilentlyContinue)) { $missing += $_ }
    }
    if ($missing.Count -gt 0) {
        Write-Err "Missing tools: $($missing -join ', '). Please install them first."
    }

    # Verify AWS credentials
    try {
        $script:AwsAccountId = (aws sts get-caller-identity --query Account --output text).Trim()
        $script:EcrRegistry = "$($script:AwsAccountId).dkr.ecr.$AwsRegion.amazonaws.com"
        Write-Ok "AWS credentials OK (Account: $($script:AwsAccountId))"
    } catch {
        Write-Err "AWS credentials not configured. Run 'aws configure'."
    }
}

# ─── Step 2: Terraform Backend ──────────────────────────────────────────────
function New-TerraformBackend {
    Write-Log "Checking Terraform backend (S3 + DynamoDB)..."
    $suffix = $script:AwsAccountId.Substring($script:AwsAccountId.Length - 6)
    $bucketName = "task-mgmt-tf-state-$suffix"

    $bucketExists = aws s3api head-bucket --bucket $bucketName 2>$null; $LASTEXITCODE -eq 0
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "S3 bucket '$bucketName' already exists"
    } else {
        Write-Log "Creating S3 bucket: $bucketName"
        aws s3 mb "s3://$bucketName" --region $AwsRegion
        aws s3api put-bucket-versioning --bucket $bucketName --versioning-configuration Status=Enabled
        Write-Ok "S3 bucket created"
    }

    $tableName = "task-mgmt-tf-locks"
    try {
        aws dynamodb describe-table --table-name $tableName --region $AwsRegion 2>$null | Out-Null
        Write-Ok "DynamoDB table '$tableName' already exists"
    } catch {
        Write-Log "Creating DynamoDB table: $tableName"
        aws dynamodb create-table `
            --table-name $tableName `
            --attribute-definitions AttributeName=LockID,AttributeType=S `
            --key-schema AttributeName=LockID,KeyType=HASH `
            --billing-mode PAY_PER_REQUEST `
            --region $AwsRegion
        Write-Ok "DynamoDB table created"
    }
}

# ─── Step 3: Provision Infrastructure ────────────────────────────────────────
function Deploy-Infrastructure {
    Write-Log "══════════════════════════════════════════════════"
    Write-Log "  Provisioning EKS Infrastructure with Terraform"
    Write-Log "══════════════════════════════════════════════════"

    Push-Location $TfDir
    try {
        Write-Log "terraform init..."
        terraform init

        Write-Log "terraform plan..."
        terraform plan -out=tfplan

        $confirm = Read-Host "Review the plan above. Continue? (y/N)"
        if ($confirm -ne 'y' -and $confirm -ne 'Y') {
            Write-Warn "Aborted."
            return
        }

        Write-Log "terraform apply..."
        terraform apply tfplan
        Write-Ok "Infrastructure provisioned!"
        terraform output
    } finally {
        Pop-Location
    }
}

# ─── Step 4: Configure kubectl ──────────────────────────────────────────────
function Set-Kubectl {
    Write-Log "Configuring kubectl for EKS: $EksCluster"
    aws eks update-kubeconfig --region $AwsRegion --name $EksCluster

    kubectl cluster-info | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Err "Cannot connect to EKS cluster" }

    kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -
    Write-Ok "kubectl configured"
    kubectl get nodes
}

# ─── Step 5: ECR Login & Build ──────────────────────────────────────────────
function Connect-Ecr {
    Write-Log "Logging in to ECR..."
    $password = aws ecr get-login-password --region $AwsRegion
    $password | docker login --username AWS --password-stdin $script:EcrRegistry
    Write-Ok "Logged in to ECR"
}

function Build-AndPush {
    param([string]$Svc)
    Write-Log "Building $Svc (tag: $ImageTag)..."

    $fullTag = "$($script:EcrRegistry)/task-management/${Svc}:${ImageTag}"
    $latestTag = "$($script:EcrRegistry)/task-management/${Svc}:latest"

    docker build `
        -t $fullTag `
        -t $latestTag `
        -f "service/$Svc/Dockerfile" `
        .

    docker push $fullTag
    docker push $latestTag
    Write-Ok "$Svc pushed to ECR"
}

function Build-AllServices {
    Write-Log "══════════════════════════════════════════════════"
    Write-Log "  Building & Pushing Docker Images"
    Write-Log "══════════════════════════════════════════════════"

    Connect-Ecr

    if ($SingleService) {
        Build-AndPush -Svc $SingleService
    } else {
        foreach ($svc in $Services) {
            Build-AndPush -Svc $svc
        }
    }
    Write-Ok "All images pushed"
}

# ─── Step 6: Deploy via Helm ────────────────────────────────────────────────
function Deploy-Service {
    param([string]$Svc)
    Write-Log "Deploying $Svc to EKS (namespace: $Namespace)..."

    helm upgrade --install $Svc "./$ChartDir" `
        --namespace $Namespace `
        --create-namespace `
        --values "apps/$Svc/values-eks.yaml" `
        --set "microservice.image.repository=$($script:EcrRegistry)/task-management/$Svc" `
        --set "microservice.image.tag=$ImageTag" `
        --timeout 5m `
        --wait `
        --atomic

    kubectl rollout status "deployment/$Svc" -n $Namespace --timeout=300s
    Write-Ok "$Svc deployed and healthy"
}

function Deploy-AllServices {
    Write-Log "══════════════════════════════════════════════════"
    Write-Log "  Deploying Services to EKS"
    Write-Log "══════════════════════════════════════════════════"

    if ($SingleService) {
        Deploy-Service -Svc $SingleService
    } else {
        foreach ($svc in $Services) {
            Deploy-Service -Svc $svc
        }
    }
}

# ─── Step 7: Verify ─────────────────────────────────────────────────────────
function Test-Deployment {
    Write-Log "══════════════════════════════════════════════════"
    Write-Log "  Verifying Deployment"
    Write-Log "══════════════════════════════════════════════════"

    Write-Log "Deployments:"
    kubectl get deployments -n $Namespace
    Write-Log "Pods:"
    kubectl get pods -n $Namespace
    Write-Log "Services:"
    kubectl get svc -n $Namespace
}

# ─── Main ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    Task Management - EKS Deployment (Windows)    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Log "Region:    $AwsRegion"
Write-Log "Cluster:   $EksCluster"
Write-Log "Namespace: $Namespace"
Write-Log "Image Tag: $ImageTag"
Write-Host ""

Test-Prerequisites

if ($ServicesOnly) {
    Set-Kubectl
    Build-AllServices
    Deploy-AllServices
    Test-Deployment
} elseif ($InfraOnly) {
    New-TerraformBackend
    Deploy-Infrastructure
    Set-Kubectl
} else {
    # Full deployment
    New-TerraformBackend
    Deploy-Infrastructure
    Set-Kubectl
    Build-AllServices
    Deploy-AllServices
    Test-Deployment
}

Write-Host ""
Write-Ok "══════════════════════════════════════════════════"
Write-Ok "  Deployment complete!"
Write-Ok "══════════════════════════════════════════════════"
