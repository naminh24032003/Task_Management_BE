#!/bin/bash
# =============================================================================
# Minikube Full Stack Deploy Script
# Deploy: Istio + Monitoring + Logging + Services
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Configuration
NAMESPACE="${NAMESPACE:-dev}"
MONITORING_NAMESPACE="monitoring"
LOGGING_NAMESPACE="logging"
ISTIO_PROFILE="${ISTIO_PROFILE:-demo}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# =============================================================================
# Pre-flight checks
# =============================================================================
preflight_check() {
    log_step "Running pre-flight checks..."
    
    # Check minikube
    if ! command -v minikube &> /dev/null; then
        log_error "minikube is not installed"
        exit 1
    fi
    
    # Check minikube status
    if ! minikube status | grep -q "Running"; then
        log_warning "Minikube is not running. Starting..."
        minikube start --memory=8192 --cpus=4 --driver=docker
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed"
        exit 1
    fi
    
    # Check istioctl
    if ! command -v istioctl &> /dev/null; then
        log_warning "istioctl is not installed. Installing..."
        curl -L https://istio.io/downloadIstio | ISTIO_VERSION=1.22.0 sh -
        export PATH="$HOME/istio-1.22.0/bin:$PATH"
    fi
    
    log_success "Pre-flight checks passed"
}

# =============================================================================
# Create namespaces
# =============================================================================
create_namespaces() {
    log_step "Creating namespaces..."
    
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace $MONITORING_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace $LOGGING_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace kong --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Namespaces created"
}

# =============================================================================
# Install Istio
# =============================================================================
install_istio() {
    log_step "Installing Istio with profile: $ISTIO_PROFILE"
    
    # Install Istio
    istioctl install --set profile=$ISTIO_PROFILE -y
    
    # Wait for Istio to be ready
    log_info "Waiting for Istio to be ready..."
    kubectl wait --for=condition=ready pod -l app=istiod -n istio-system --timeout=300s
    
    # Install Jaeger for tracing
    log_info "Installing Jaeger..."
    kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons/jaeger.yaml
    
    # Wait for Jaeger
    sleep 10
    kubectl wait --for=condition=ready pod -l app=jaeger -n istio-system --timeout=120s || true
    
    # Label namespace for injection
    kubectl label namespace $NAMESPACE istio-injection=enabled --overwrite
    
    # Ensure Kong namespace does NOT have injection
    kubectl label namespace kong istio-injection=disabled --overwrite
    
    log_success "Istio installed"
}

# =============================================================================
# Install Monitoring Stack (kube-prometheus-stack)
# =============================================================================
install_monitoring() {
    log_step "Installing Monitoring Stack..."
    
    # Add Helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Update dependencies
    cd "${PROJECT_ROOT}/charts/platform/monitoring"
    helm dependency update
    
    # Install monitoring
    helm upgrade --install monitoring . \
        --namespace $MONITORING_NAMESPACE \
        --create-namespace \
        --set kube-prometheus-stack.prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
        --set kube-prometheus-stack.prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
        --set kube-prometheus-stack.grafana.persistence.enabled=false \
        --set kube-prometheus-stack.prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=5Gi \
        --set kube-prometheus-stack.alertmanager.alertmanagerSpec.storage.volumeClaimTemplate.spec.resources.requests.storage=2Gi \
        --wait \
        --timeout 10m
    
    log_success "Monitoring stack installed"
}

# =============================================================================
# Install Logging Stack (Loki)
# =============================================================================
install_logging() {
    log_step "Installing Logging Stack..."
    
    # Add Helm repo
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Update dependencies
    cd "${PROJECT_ROOT}/charts/platform/logging"
    helm dependency update
    
    # Install logging
    helm upgrade --install logging . \
        --namespace $LOGGING_NAMESPACE \
        --create-namespace \
        --set loki-stack.loki.persistence.enabled=false \
        --wait \
        --timeout 10m
    
    log_success "Logging stack installed"
}

# =============================================================================
# Install Istio Config (VirtualServices, DestinationRules, etc.)
# =============================================================================
install_istio_config() {
    log_step "Installing Istio Configuration..."
    
    cd "${PROJECT_ROOT}/charts/platform/istio"
    
    helm upgrade --install istio-config . \
        --namespace $NAMESPACE \
        --set namespace=$NAMESPACE \
        --set monitoring.namespace=$MONITORING_NAMESPACE \
        --set monitoring.prometheusRelease=monitoring \
        --set security.mtls.mode=PERMISSIVE \
        --wait \
        --timeout 5m
    
    log_success "Istio configuration installed"
}

# =============================================================================
# Install Application Services
# =============================================================================
install_services() {
    log_step "Installing Application Services..."
    
    # Update microservice chart dependencies
    cd "${PROJECT_ROOT}/charts/microservice"
    helm dependency update 2>/dev/null || true
    
    # Install task-service
    log_info "Installing task-service..."
    cd "${PROJECT_ROOT}/apps/task-service"
    helm dependency update 2>/dev/null || true
    helm upgrade --install task-service . \
        --namespace $NAMESPACE \
        -f values-minikube.yaml \
        --set podLabels.version=v1 \
        --wait \
        --timeout 5m || log_warning "task-service install skipped (may need image)"
    
    # Install user-service
    log_info "Installing user-service..."
    cd "${PROJECT_ROOT}/apps/user-service"
    helm dependency update 2>/dev/null || true
    helm upgrade --install user-service . \
        --namespace $NAMESPACE \
        -f values-minikube.yaml \
        --set podLabels.version=v1 \
        --wait \
        --timeout 5m || log_warning "user-service install skipped (may need image)"
    
    log_success "Application services installed"
}

# =============================================================================
# Verify Installation
# =============================================================================
verify_installation() {
    log_step "Verifying installation..."
    
    echo ""
    echo "=== Istio System Pods ==="
    kubectl get pods -n istio-system
    
    echo ""
    echo "=== Monitoring Pods ==="
    kubectl get pods -n $MONITORING_NAMESPACE
    
    echo ""
    echo "=== Logging Pods ==="
    kubectl get pods -n $LOGGING_NAMESPACE
    
    echo ""
    echo "=== Application Pods (with sidecars) ==="
    kubectl get pods -n $NAMESPACE -o custom-columns='NAME:.metadata.name,CONTAINERS:.spec.containers[*].name,STATUS:.status.phase,READY:.status.containerStatuses[*].ready'
    
    echo ""
    echo "=== Istio Resources ==="
    kubectl get virtualservices,destinationrules,peerauthentications -n $NAMESPACE 2>/dev/null || true
    
    echo ""
    echo "=== ServiceMonitors ==="
    kubectl get servicemonitors,podmonitors -n $MONITORING_NAMESPACE 2>/dev/null || true
}

# =============================================================================
# Port Forward Services
# =============================================================================
show_port_forward_commands() {
    log_step "Port forward commands:"
    
    echo ""
    echo "Run these commands in separate terminals:"
    echo ""
    echo -e "${CYAN}# Grafana (admin/prom-operator)${NC}"
    echo "kubectl port-forward svc/monitoring-grafana -n $MONITORING_NAMESPACE 3000:80"
    echo ""
    echo -e "${CYAN}# Prometheus${NC}"
    echo "kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n $MONITORING_NAMESPACE 9090:9090"
    echo ""
    echo -e "${CYAN}# Jaeger${NC}"
    echo "kubectl port-forward svc/tracing -n istio-system 16686:80"
    echo ""
    echo -e "${CYAN}# Alertmanager${NC}"
    echo "kubectl port-forward svc/monitoring-kube-prometheus-alertmanager -n $MONITORING_NAMESPACE 9093:9093"
    echo ""
}

# =============================================================================
# Quick Test
# =============================================================================
quick_test() {
    log_step "Running quick test..."
    
    # Check if services have sidecars
    PODS=$(kubectl get pods -n $NAMESPACE -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$PODS" ]; then
        log_warning "No pods in namespace $NAMESPACE yet"
        return
    fi
    
    for pod in $PODS; do
        CONTAINERS=$(kubectl get pod $pod -n $NAMESPACE -o jsonpath='{.spec.containers[*].name}')
        if echo "$CONTAINERS" | grep -q "istio-proxy"; then
            log_success "Pod $pod has istio-proxy sidecar ✓"
        else
            log_warning "Pod $pod does NOT have istio-proxy sidecar"
        fi
    done
    
    # Check Prometheus targets
    log_info "Checking Prometheus can scrape Istio metrics..."
    echo "Visit http://localhost:9090/targets after port-forwarding"
}

# =============================================================================
# Main
# =============================================================================
main() {
    echo "=============================================="
    echo "   Minikube Full Stack Deployment"
    echo "   Istio + Monitoring + Logging"
    echo "=============================================="
    echo ""
    
    case "${1:-all}" in
        preflight)
            preflight_check
            ;;
        namespaces)
            create_namespaces
            ;;
        istio)
            install_istio
            ;;
        monitoring)
            install_monitoring
            ;;
        logging)
            install_logging
            ;;
        istio-config)
            install_istio_config
            ;;
        services)
            install_services
            ;;
        verify)
            verify_installation
            ;;
        port-forward)
            show_port_forward_commands
            ;;
        test)
            quick_test
            ;;
        all)
            preflight_check
            create_namespaces
            install_istio
            install_monitoring
            install_logging
            install_istio_config
            install_services
            verify_installation
            show_port_forward_commands
            ;;
        *)
            echo "Usage: $0 {preflight|namespaces|istio|monitoring|logging|istio-config|services|verify|port-forward|test|all}"
            exit 1
            ;;
    esac
    
    log_success "Operation completed!"
}

main "$@"
