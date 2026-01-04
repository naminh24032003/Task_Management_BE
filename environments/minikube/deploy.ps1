# =============================================================================
# Minikube Full Stack Deploy Script (PowerShell)
# Deploy: Istio + Monitoring + Logging + Services
# =============================================================================

param(
    [Parameter(Position=0)]
    [ValidateSet("preflight", "namespaces", "istio", "monitoring", "logging", "istio-config", "services", "verify", "port-forward", "test", "all")]
    [string]$Action = "all",
    
    [string]$Namespace = "dev",
    [string]$IstioProfile = "demo"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

# Configuration
$MonitoringNamespace = "monitoring"
$LoggingNamespace = "logging"

# Colors
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Blue }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARNING] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-Step { Write-Host "[STEP] $args" -ForegroundColor Cyan }

# =============================================================================
# Pre-flight checks
# =============================================================================
function Test-Preflight {
    Write-Step "Running pre-flight checks..."
    
    # Check minikube
    if (-not (Get-Command minikube -ErrorAction SilentlyContinue)) {
        Write-Err "minikube is not installed"
        exit 1
    }
    
    # Check minikube status
    $status = minikube status 2>$null
    if ($status -notmatch "Running") {
        Write-Warn "Minikube is not running. Starting..."
        minikube start --memory=8192 --cpus=4 --driver=docker
    }
    
    # Check kubectl
    if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
        Write-Err "kubectl is not installed"
        exit 1
    }
    
    # Check helm
    if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
        Write-Err "helm is not installed"
        exit 1
    }
    
    # Check istioctl
    if (-not (Get-Command istioctl -ErrorAction SilentlyContinue)) {
        Write-Warn "istioctl is not installed"
        Write-Info "Please download from: https://istio.io/latest/docs/setup/getting-started/#download"
        Write-Info "Or run: winget install Istio.Istioctl"
        exit 1
    }
    
    Write-Success "Pre-flight checks passed"
}

# =============================================================================
# Create namespaces
# =============================================================================
function New-Namespaces {
    Write-Step "Creating namespaces..."
    
    kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace $MonitoringNamespace --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace $LoggingNamespace --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace kong --dry-run=client -o yaml | kubectl apply -f -
    
    Write-Success "Namespaces created"
}

# =============================================================================
# Install Istio
# =============================================================================
function Install-Istio {
    Write-Step "Installing Istio with profile: $IstioProfile"
    
    # Install Istio
    istioctl install --set profile=$IstioProfile -y
    if ($LASTEXITCODE -ne 0) { throw "Failed to install Istio" }
    
    # Wait for Istio to be ready
    Write-Info "Waiting for Istio to be ready..."
    kubectl wait --for=condition=ready pod -l app=istiod -n istio-system --timeout=300s
    
    # Install Jaeger for tracing
    Write-Info "Installing Jaeger..."
    kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons/jaeger.yaml
    
    # Wait for Jaeger
    Start-Sleep -Seconds 10
    kubectl wait --for=condition=ready pod -l app=jaeger -n istio-system --timeout=120s 2>$null
    
    # Label namespace for injection
    kubectl label namespace $Namespace istio-injection=enabled --overwrite
    
    # Ensure Kong namespace does NOT have injection
    kubectl label namespace kong istio-injection=disabled --overwrite
    
    Write-Success "Istio installed"
}

# =============================================================================
# Install Monitoring Stack
# =============================================================================
function Install-Monitoring {
    Write-Step "Installing Monitoring Stack..."
    
    # Add Helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Update dependencies
    Push-Location "$ProjectRoot\charts\platform\monitoring"
    helm dependency update
    
    # Install monitoring
    helm upgrade --install monitoring . `
        --namespace $MonitoringNamespace `
        --create-namespace `
        --set kube-prometheus-stack.prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false `
        --set kube-prometheus-stack.prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false `
        --set kube-prometheus-stack.grafana.persistence.enabled=false `
        --set kube-prometheus-stack.prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=5Gi `
        --set kube-prometheus-stack.alertmanager.alertmanagerSpec.storage.volumeClaimTemplate.spec.resources.requests.storage=2Gi `
        --wait `
        --timeout 10m
    
    Pop-Location
    
    Write-Success "Monitoring stack installed"
}

# =============================================================================
# Install Logging Stack
# =============================================================================
function Install-Logging {
    Write-Step "Installing Logging Stack..."
    
    # Add Helm repo
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Update dependencies
    Push-Location "$ProjectRoot\charts\platform\logging"
    helm dependency update
    
    # Install logging
    helm upgrade --install logging . `
        --namespace $LoggingNamespace `
        --create-namespace `
        --set loki-stack.loki.persistence.enabled=false `
        --wait `
        --timeout 10m
    
    Pop-Location
    
    Write-Success "Logging stack installed"
}

# =============================================================================
# Install Istio Config
# =============================================================================
function Install-IstioConfig {
    Write-Step "Installing Istio Configuration..."
    
    Push-Location "$ProjectRoot\charts\platform\istio"
    
    helm upgrade --install istio-config . `
        --namespace $Namespace `
        --set namespace=$Namespace `
        --set monitoring.namespace=$MonitoringNamespace `
        --set monitoring.prometheusRelease=monitoring `
        --set security.mtls.mode=PERMISSIVE `
        --wait `
        --timeout 5m
    
    Pop-Location
    
    Write-Success "Istio configuration installed"
}

# =============================================================================
# Install Application Services
# =============================================================================
function Install-Services {
    Write-Step "Installing Application Services..."
    
    # Update microservice chart dependencies
    Push-Location "$ProjectRoot\charts\microservice"
    helm dependency update 2>$null
    Pop-Location
    
    # Install task-service
    Write-Info "Installing task-service..."
    Push-Location "$ProjectRoot\apps\task-service"
    helm dependency update 2>$null
    try {
        helm upgrade --install task-service . `
            --namespace $Namespace `
            -f values-minikube.yaml `
            --set podLabels.version=v1 `
            --wait `
            --timeout 5m
    } catch {
        Write-Warn "task-service install skipped (may need image)"
    }
    Pop-Location
    
    # Install user-service
    Write-Info "Installing user-service..."
    Push-Location "$ProjectRoot\apps\user-service"
    helm dependency update 2>$null
    try {
        helm upgrade --install user-service . `
            --namespace $Namespace `
            -f values-minikube.yaml `
            --set podLabels.version=v1 `
            --wait `
            --timeout 5m
    } catch {
        Write-Warn "user-service install skipped (may need image)"
    }
    Pop-Location
    
    Write-Success "Application services installed"
}

# =============================================================================
# Verify Installation
# =============================================================================
function Test-Installation {
    Write-Step "Verifying installation..."
    
    Write-Host ""
    Write-Host "=== Istio System Pods ===" -ForegroundColor Cyan
    kubectl get pods -n istio-system
    
    Write-Host ""
    Write-Host "=== Monitoring Pods ===" -ForegroundColor Cyan
    kubectl get pods -n $MonitoringNamespace
    
    Write-Host ""
    Write-Host "=== Logging Pods ===" -ForegroundColor Cyan
    kubectl get pods -n $LoggingNamespace
    
    Write-Host ""
    Write-Host "=== Application Pods (with sidecars) ===" -ForegroundColor Cyan
    kubectl get pods -n $Namespace -o custom-columns='NAME:.metadata.name,CONTAINERS:.spec.containers[*].name,STATUS:.status.phase'
    
    Write-Host ""
    Write-Host "=== Istio Resources ===" -ForegroundColor Cyan
    kubectl get virtualservices,destinationrules,peerauthentications -n $Namespace 2>$null
    
    Write-Host ""
    Write-Host "=== ServiceMonitors ===" -ForegroundColor Cyan
    kubectl get servicemonitors,podmonitors -n $MonitoringNamespace 2>$null
}

# =============================================================================
# Port Forward Commands
# =============================================================================
function Show-PortForwardCommands {
    Write-Step "Port forward commands:"
    
    Write-Host ""
    Write-Host "Run these commands in separate terminals:" -ForegroundColor White
    Write-Host ""
    Write-Host "# Grafana (admin/prom-operator)" -ForegroundColor Cyan
    Write-Host "kubectl port-forward svc/monitoring-grafana -n $MonitoringNamespace 3000:80" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "# Prometheus" -ForegroundColor Cyan
    Write-Host "kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n $MonitoringNamespace 9090:9090" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "# Jaeger" -ForegroundColor Cyan
    Write-Host "kubectl port-forward svc/tracing -n istio-system 16686:80" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "# Alertmanager" -ForegroundColor Cyan
    Write-Host "kubectl port-forward svc/monitoring-kube-prometheus-alertmanager -n $MonitoringNamespace 9093:9093" -ForegroundColor Yellow
    Write-Host ""
}

# =============================================================================
# Quick Test
# =============================================================================
function Invoke-QuickTest {
    Write-Step "Running quick test..."
    
    $pods = kubectl get pods -n $Namespace -o jsonpath='{.items[*].metadata.name}' 2>$null
    
    if ([string]::IsNullOrWhiteSpace($pods)) {
        Write-Warn "No pods in namespace $Namespace yet"
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
    
    Write-Info "Checking Prometheus can scrape Istio metrics..."
    Write-Host "Visit http://localhost:9090/targets after port-forwarding" -ForegroundColor Yellow
}

# =============================================================================
# Main
# =============================================================================
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   Minikube Full Stack Deployment" -ForegroundColor Cyan
Write-Host "   Istio + Monitoring + Logging" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

switch ($Action) {
    "preflight" { Test-Preflight }
    "namespaces" { New-Namespaces }
    "istio" { Install-Istio }
    "monitoring" { Install-Monitoring }
    "logging" { Install-Logging }
    "istio-config" { Install-IstioConfig }
    "services" { Install-Services }
    "verify" { Test-Installation }
    "port-forward" { Show-PortForwardCommands }
    "test" { Invoke-QuickTest }
    "all" {
        Test-Preflight
        New-Namespaces
        Install-Istio
        Install-Monitoring
        Install-Logging
        Install-IstioConfig
        Install-Services
        Test-Installation
        Show-PortForwardCommands
    }
}

Write-Success "Operation completed!"
