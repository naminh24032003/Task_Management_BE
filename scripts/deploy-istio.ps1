# PowerShell script for Istio Installation and Configuration
# =============================================================================

param(
    [Parameter(Position=0)]
    [ValidateSet("install", "enable-mesh", "restart", "verify-sidecars", "deploy-config", "addons", "verify", "dashboards", "all")]
    [string]$Action = "all",
    
    [string]$Namespace = "dev",
    [string]$IstioProfile = "demo"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Colors
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Blue }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARNING] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

# =============================================================================
# Step 1: Install Istio
# =============================================================================
function Install-Istio {
    Write-Info "Step 1: Installing Istio with profile: $IstioProfile"
    
    # Check if istioctl is installed
    if (-not (Get-Command istioctl -ErrorAction SilentlyContinue)) {
        Write-Err "istioctl is not installed. Please install it first."
        Write-Info "Download from: https://istio.io/latest/docs/setup/getting-started/#download"
        exit 1
    }

    # Install Istio
    istioctl install --set profile=$IstioProfile -y
    if ($LASTEXITCODE -ne 0) { throw "Failed to install Istio" }

    # Wait for istio-system pods to be ready
    Write-Info "Waiting for Istio pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=istiod -n istio-system --timeout=300s
    
    Write-Success "Istio installed successfully"
}

# =============================================================================
# Step 2: Enable mesh for namespace
# =============================================================================
function Enable-MeshNamespace {
    Write-Info "Step 2: Enabling Istio injection for namespace: $Namespace"
    
    # Create namespace if not exists
    kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -
    
    # Label namespace for automatic sidecar injection
    kubectl label namespace $Namespace istio-injection=enabled --overwrite
    
    Write-Success "Namespace $Namespace labeled for Istio injection"
}

# =============================================================================
# Step 3: Restart deployments to inject sidecars
# =============================================================================
function Restart-Deployments {
    Write-Info "Step 3: Restarting deployments to inject Istio sidecars"
    
    # Get all deployments in namespace
    $deployments = kubectl get deployments -n $Namespace -o jsonpath='{.items[*].metadata.name}' 2>$null
    
    if ([string]::IsNullOrWhiteSpace($deployments)) {
        Write-Warn "No deployments found in namespace $Namespace"
        return
    }
    
    $deploymentList = $deployments -split '\s+'
    
    foreach ($deploy in $deploymentList) {
        if (-not [string]::IsNullOrWhiteSpace($deploy)) {
            Write-Info "Restarting deployment: $deploy"
            kubectl rollout restart deployment/$deploy -n $Namespace
        }
    }
    
    # Wait for rollout to complete
    foreach ($deploy in $deploymentList) {
        if (-not [string]::IsNullOrWhiteSpace($deploy)) {
            Write-Info "Waiting for rollout of $deploy..."
            kubectl rollout status deployment/$deploy -n $Namespace --timeout=300s
        }
    }
    
    Write-Success "All deployments restarted with Istio sidecars"
}

# =============================================================================
# Step 4: Verify sidecar injection
# =============================================================================
function Test-Sidecars {
    Write-Info "Step 4: Verifying Istio sidecar injection"
    
    $pods = kubectl get pods -n $Namespace -o jsonpath='{.items[*].metadata.name}' 2>$null
    
    if ([string]::IsNullOrWhiteSpace($pods)) {
        Write-Warn "No pods found in namespace $Namespace"
        return
    }
    
    $podList = $pods -split '\s+'
    
    foreach ($pod in $podList) {
        if (-not [string]::IsNullOrWhiteSpace($pod)) {
            $containers = kubectl get pod $pod -n $Namespace -o jsonpath='{.spec.containers[*].name}'
            if ($containers -match "istio-proxy") {
                Write-Success "Pod $pod has istio-proxy sidecar"
            } else {
                Write-Warn "Pod $pod does NOT have istio-proxy sidecar"
            }
        }
    }
}

# =============================================================================
# Step 5: Deploy Istio configurations
# =============================================================================
function Deploy-IstioConfig {
    Write-Info "Step 5: Deploying Istio configurations"
    
    $chartPath = Join-Path $ScriptDir "..\charts\platform\istio"
    
    helm upgrade --install istio-config $chartPath `
        --namespace $Namespace `
        --create-namespace `
        --wait
    
    if ($LASTEXITCODE -ne 0) { throw "Failed to deploy Istio config" }
    
    Write-Success "Istio configurations deployed"
}

# =============================================================================
# Step 6: Install observability addons
# =============================================================================
function Install-Addons {
    Write-Info "Step 6: Installing Istio observability addons"
    
    $istioVersion = (istioctl version --short 2>$null | Select-Object -First 1)
    $addonsUrl = "https://raw.githubusercontent.com/istio/istio/$istioVersion/samples/addons"
    
    # Install Prometheus
    Write-Info "Installing Prometheus..."
    kubectl apply -f "$addonsUrl/prometheus.yaml" 2>$null
    
    # Install Jaeger
    Write-Info "Installing Jaeger..."
    kubectl apply -f "$addonsUrl/jaeger.yaml" 2>$null
    
    # Install Kiali
    Write-Info "Installing Kiali..."
    kubectl apply -f "$addonsUrl/kiali.yaml" 2>$null
    
    # Install Grafana
    Write-Info "Installing Grafana..."
    kubectl apply -f "$addonsUrl/grafana.yaml" 2>$null
    
    # Wait for addons to be ready
    Write-Info "Waiting for addons to be ready..."
    Start-Sleep -Seconds 30
    
    Write-Success "Observability addons installed"
}

# =============================================================================
# Verify installation
# =============================================================================
function Test-Installation {
    Write-Info "Verifying Istio installation..."
    
    Write-Host ""
    Write-Host "=== Istio System Pods ===" -ForegroundColor Cyan
    kubectl get pods -n istio-system
    
    Write-Host ""
    Write-Host "=== Namespace Labels ===" -ForegroundColor Cyan
    kubectl get namespace $Namespace --show-labels
    
    Write-Host ""
    Write-Host "=== Application Pods (with containers) ===" -ForegroundColor Cyan
    kubectl get pods -n $Namespace -o=custom-columns='NAME:.metadata.name,CONTAINERS:.spec.containers[*].name,STATUS:.status.phase'
    
    Write-Host ""
    Write-Host "=== Istio Resources ===" -ForegroundColor Cyan
    kubectl get virtualservices,destinationrules,peerauthentications,authorizationpolicies -n $Namespace
}

# =============================================================================
# Port forward for dashboard access
# =============================================================================
function Show-DashboardCommands {
    Write-Info "Dashboard access commands:"
    
    Write-Host ""
    Write-Host "Run the following commands in separate terminals:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Kiali:      kubectl port-forward svc/kiali -n istio-system 20001:20001" -ForegroundColor Yellow
    Write-Host "Jaeger:     kubectl port-forward svc/tracing -n istio-system 16686:80" -ForegroundColor Yellow
    Write-Host "Prometheus: kubectl port-forward svc/prometheus -n istio-system 9090:9090" -ForegroundColor Yellow
    Write-Host "Grafana:    kubectl port-forward svc/grafana -n istio-system 3000:3000" -ForegroundColor Yellow
    Write-Host ""
}

# =============================================================================
# Main
# =============================================================================
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   Istio Service Mesh Installation Script" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

switch ($Action) {
    "install" { Install-Istio }
    "enable-mesh" { Enable-MeshNamespace }
    "restart" { Restart-Deployments }
    "verify-sidecars" { Test-Sidecars }
    "deploy-config" { Deploy-IstioConfig }
    "addons" { Install-Addons }
    "verify" { Test-Installation }
    "dashboards" { Show-DashboardCommands }
    "all" {
        Install-Istio
        Enable-MeshNamespace
        Deploy-IstioConfig
        Restart-Deployments
        Test-Sidecars
        Install-Addons
        Test-Installation
        Show-DashboardCommands
    }
}

Write-Success "Operation completed!"
