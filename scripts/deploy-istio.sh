#!/bin/bash
# =============================================================================
# Istio Installation and Configuration Script
# =============================================================================

set -e

NAMESPACE="${NAMESPACE:-dev}"
ISTIO_PROFILE="${ISTIO_PROFILE:-demo}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Step 1: Install Istio
# =============================================================================
install_istio() {
    log_info "Step 1: Installing Istio with profile: $ISTIO_PROFILE"
    
    # Check if istioctl is installed
    if ! command -v istioctl &> /dev/null; then
        log_error "istioctl is not installed. Please install it first."
        log_info "Run: curl -L https://istio.io/downloadIstio | sh -"
        exit 1
    fi

    # Install Istio
    istioctl install --set profile=$ISTIO_PROFILE -y

    # Wait for istio-system pods to be ready
    log_info "Waiting for Istio pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=istiod -n istio-system --timeout=300s
    kubectl wait --for=condition=ready pod -l app=istio-ingressgateway -n istio-system --timeout=300s || true
    
    log_success "Istio installed successfully"
}

# =============================================================================
# Step 2: Enable mesh for namespace
# =============================================================================
enable_mesh_namespace() {
    log_info "Step 2: Enabling Istio injection for namespace: $NAMESPACE"
    
    # Create namespace if not exists
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Label namespace for automatic sidecar injection
    kubectl label namespace $NAMESPACE istio-injection=enabled --overwrite
    
    log_success "Namespace $NAMESPACE labeled for Istio injection"
}

# =============================================================================
# Step 3: Restart deployments to inject sidecars
# =============================================================================
restart_deployments() {
    log_info "Step 3: Restarting deployments to inject Istio sidecars"
    
    # Get all deployments in namespace
    DEPLOYMENTS=$(kubectl get deployments -n $NAMESPACE -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$DEPLOYMENTS" ]; then
        log_warning "No deployments found in namespace $NAMESPACE"
        return
    fi
    
    for deploy in $DEPLOYMENTS; do
        log_info "Restarting deployment: $deploy"
        kubectl rollout restart deployment/$deploy -n $NAMESPACE
    done
    
    # Wait for rollout to complete
    for deploy in $DEPLOYMENTS; do
        log_info "Waiting for rollout of $deploy..."
        kubectl rollout status deployment/$deploy -n $NAMESPACE --timeout=300s
    done
    
    log_success "All deployments restarted with Istio sidecars"
}

# =============================================================================
# Step 4: Verify sidecar injection
# =============================================================================
verify_sidecars() {
    log_info "Step 4: Verifying Istio sidecar injection"
    
    # Check pods have istio-proxy container
    PODS=$(kubectl get pods -n $NAMESPACE -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$PODS" ]; then
        log_warning "No pods found in namespace $NAMESPACE"
        return
    fi
    
    for pod in $PODS; do
        CONTAINERS=$(kubectl get pod $pod -n $NAMESPACE -o jsonpath='{.spec.containers[*].name}')
        if echo "$CONTAINERS" | grep -q "istio-proxy"; then
            log_success "Pod $pod has istio-proxy sidecar"
        else
            log_warning "Pod $pod does NOT have istio-proxy sidecar"
        fi
    done
}

# =============================================================================
# Step 5: Deploy Istio configurations
# =============================================================================
deploy_istio_config() {
    log_info "Step 5: Deploying Istio configurations"
    
    # Deploy using Helm
    helm upgrade --install istio-config "${SCRIPT_DIR}/../charts/platform/istio" \
        --namespace $NAMESPACE \
        --create-namespace \
        --wait
    
    log_success "Istio configurations deployed"
}

# =============================================================================
# Step 6: Install observability addons
# =============================================================================
install_addons() {
    log_info "Step 6: Installing Istio observability addons"
    
    ISTIO_VERSION=$(istioctl version --short 2>/dev/null | head -1)
    ADDONS_URL="https://raw.githubusercontent.com/istio/istio/${ISTIO_VERSION}/samples/addons"
    
    # Install Prometheus
    log_info "Installing Prometheus..."
    kubectl apply -f ${ADDONS_URL}/prometheus.yaml 2>/dev/null || log_warning "Could not install Prometheus"
    
    # Install Jaeger
    log_info "Installing Jaeger..."
    kubectl apply -f ${ADDONS_URL}/jaeger.yaml 2>/dev/null || log_warning "Could not install Jaeger"
    
    # Install Kiali
    log_info "Installing Kiali..."
    kubectl apply -f ${ADDONS_URL}/kiali.yaml 2>/dev/null || log_warning "Could not install Kiali"
    
    # Install Grafana
    log_info "Installing Grafana..."
    kubectl apply -f ${ADDONS_URL}/grafana.yaml 2>/dev/null || log_warning "Could not install Grafana"
    
    # Wait for addons to be ready
    log_info "Waiting for addons to be ready..."
    kubectl wait --for=condition=ready pod -l app=prometheus -n istio-system --timeout=120s 2>/dev/null || true
    kubectl wait --for=condition=ready pod -l app=jaeger -n istio-system --timeout=120s 2>/dev/null || true
    kubectl wait --for=condition=ready pod -l app=kiali -n istio-system --timeout=120s 2>/dev/null || true
    
    log_success "Observability addons installed"
}

# =============================================================================
# Verify installation
# =============================================================================
verify_installation() {
    log_info "Verifying Istio installation..."
    
    echo ""
    echo "=== Istio System Pods ==="
    kubectl get pods -n istio-system
    
    echo ""
    echo "=== Namespace Labels ==="
    kubectl get namespace $NAMESPACE --show-labels
    
    echo ""
    echo "=== Application Pods (with containers) ==="
    kubectl get pods -n $NAMESPACE -o=custom-columns='NAME:.metadata.name,CONTAINERS:.spec.containers[*].name,STATUS:.status.phase'
    
    echo ""
    echo "=== Istio Resources ==="
    kubectl get virtualservices,destinationrules,peerauthentications,authorizationpolicies -n $NAMESPACE
}

# =============================================================================
# Port forward for dashboard access
# =============================================================================
port_forward_dashboards() {
    log_info "Setting up port forwarding for dashboards..."
    
    echo ""
    echo "Run the following commands in separate terminals:"
    echo ""
    echo "Kiali:      kubectl port-forward svc/kiali -n istio-system 20001:20001"
    echo "Jaeger:     kubectl port-forward svc/tracing -n istio-system 16686:80"
    echo "Prometheus: kubectl port-forward svc/prometheus -n istio-system 9090:9090"
    echo "Grafana:    kubectl port-forward svc/grafana -n istio-system 3000:3000"
    echo ""
}

# =============================================================================
# Main
# =============================================================================
main() {
    echo "=============================================="
    echo "   Istio Service Mesh Installation Script"
    echo "=============================================="
    echo ""
    
    case "${1:-all}" in
        install)
            install_istio
            ;;
        enable-mesh)
            enable_mesh_namespace
            ;;
        restart)
            restart_deployments
            ;;
        verify-sidecars)
            verify_sidecars
            ;;
        deploy-config)
            deploy_istio_config
            ;;
        addons)
            install_addons
            ;;
        verify)
            verify_installation
            ;;
        dashboards)
            port_forward_dashboards
            ;;
        all)
            install_istio
            enable_mesh_namespace
            deploy_istio_config
            restart_deployments
            verify_sidecars
            install_addons
            verify_installation
            port_forward_dashboards
            ;;
        *)
            echo "Usage: $0 {install|enable-mesh|restart|verify-sidecars|deploy-config|addons|verify|dashboards|all}"
            exit 1
            ;;
    esac
    
    log_success "Operation completed!"
}

main "$@"
