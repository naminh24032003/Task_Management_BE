#!/bin/bash

# ==========================================
# Jenkins + ArgoCD Access Helper Script
# ==========================================
# Script này giúp dễ dàng truy cập Jenkins và ArgoCD trên Minikube

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ==========================================
# Functions
# ==========================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Minikube is running
check_minikube() {
    print_info "Checking Minikube status..."
    if ! minikube status &> /dev/null; then
        print_error "Minikube is not running!"
        print_info "Starting Minikube..."
        minikube start
    else
        print_info "Minikube is running ✓"
    fi
}

# Check if Jenkins is deployed
check_jenkins() {
    print_info "Checking Jenkins deployment..."
    if kubectl get namespace jenkins &> /dev/null; then
        JENKINS_READY=$(kubectl get pods -n jenkins -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")
        if [ "$JENKINS_READY" == "True" ]; then
            print_info "Jenkins is ready ✓"
            return 0
        else
            print_warning "Jenkins is not ready yet. Please wait..."
            return 1
        fi
    else
        print_error "Jenkins is not deployed!"
        return 1
    fi
}

# Check if ArgoCD is deployed
check_argocd() {
    print_info "Checking ArgoCD deployment..."
    if kubectl get namespace argocd &> /dev/null; then
        ARGOCD_READY=$(kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")
        if [ "$ARGOCD_READY" == "True" ]; then
            print_info "ArgoCD is ready ✓"
            return 0
        else
            print_warning "ArgoCD is not ready yet. Please wait..."
            return 1
        fi
    else
        print_error "ArgoCD is not deployed!"
        return 1
    fi
}

# Get Jenkins access info
get_jenkins_info() {
    print_header "Jenkins Access Information"

    MINIKUBE_IP=$(minikube ip)
    JENKINS_PORT=$(kubectl get svc jenkins -n jenkins -o jsonpath='{.spec.ports[0].nodePort}')
    JENKINS_URL="http://${MINIKUBE_IP}:${JENKINS_PORT}"

    echo -e "${GREEN}URL:${NC} $JENKINS_URL"
    echo -e "${GREEN}Username:${NC} admin"
    echo -e "${GREEN}Password:${NC} Jenkins@2024Secure!"
    echo ""
    echo -e "${YELLOW}Opening Jenkins in browser...${NC}"

    # Open in browser based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$JENKINS_URL"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$JENKINS_URL" &> /dev/null || print_warning "Could not open browser automatically"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        start "$JENKINS_URL"
    fi
}

# Get ArgoCD access info
get_argocd_info() {
    print_header "ArgoCD Access Information"

    MINIKUBE_IP=$(minikube ip)
    ARGOCD_PORT=$(kubectl get svc argocd-server -n argocd -o jsonpath='{.spec.ports[0].nodePort}')
    ARGOCD_URL="http://${MINIKUBE_IP}:${ARGOCD_PORT}"
    ARGOCD_PASSWORD=$(kubectl get secret -n argocd argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

    echo -e "${GREEN}URL:${NC} $ARGOCD_URL"
    echo -e "${GREEN}Username:${NC} admin"
    echo -e "${GREEN}Password:${NC} $ARGOCD_PASSWORD"
    echo ""
    echo -e "${YELLOW}Opening ArgoCD in browser...${NC}"

    # Open in browser based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$ARGOCD_URL"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$ARGOCD_URL" &> /dev/null || print_warning "Could not open browser automatically"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        start "$ARGOCD_URL"
    fi
}

# Port forward function
port_forward_jenkins() {
    print_header "Starting Port Forward for Jenkins"
    print_info "Jenkins will be available at: http://localhost:8080"
    print_info "Press Ctrl+C to stop port forwarding"
    kubectl port-forward -n jenkins svc/jenkins 8080:8080
}

port_forward_argocd() {
    print_header "Starting Port Forward for ArgoCD"
    print_info "ArgoCD will be available at: http://localhost:8080"
    print_info "Press Ctrl+C to stop port forwarding"
    kubectl port-forward -n argocd svc/argocd-server 8080:80
}

# Check status of all components
check_status() {
    print_header "Checking All Components Status"

    echo ""
    print_info "Minikube Status:"
    minikube status || true

    echo ""
    print_info "Jenkins Pods:"
    kubectl get pods -n jenkins || print_error "Jenkins namespace not found"

    echo ""
    print_info "ArgoCD Pods:"
    kubectl get pods -n argocd || print_error "ArgoCD namespace not found"

    echo ""
    print_info "Jenkins Service:"
    kubectl get svc -n jenkins || print_error "Jenkins namespace not found"

    echo ""
    print_info "ArgoCD Service:"
    kubectl get svc -n argocd || print_error "ArgoCD namespace not found"
}

# Show help
show_help() {
    cat << EOF
${BLUE}Jenkins + ArgoCD Access Helper${NC}

${GREEN}Usage:${NC}
    $0 [command]

${GREEN}Commands:${NC}
    jenkins         - Show Jenkins access information and open in browser
    argocd          - Show ArgoCD access information and open in browser
    both            - Show both Jenkins and ArgoCD information
    status          - Check status of all components
    pf-jenkins      - Port forward Jenkins to localhost:8080
    pf-argocd       - Port forward ArgoCD to localhost:8080
    help            - Show this help message

${GREEN}Examples:${NC}
    $0 jenkins      # Access Jenkins
    $0 argocd       # Access ArgoCD
    $0 both         # Show info for both
    $0 status       # Check all components status

${YELLOW}Note:${NC} Make sure Minikube is running before using this script.
EOF
}

# ==========================================
# Main Script
# ==========================================

case "${1:-help}" in
    jenkins)
        check_minikube
        if check_jenkins; then
            get_jenkins_info
        fi
        ;;
    argocd)
        check_minikube
        if check_argocd; then
            get_argocd_info
        fi
        ;;
    both)
        check_minikube
        echo ""
        if check_jenkins; then
            get_jenkins_info
        fi
        echo ""
        if check_argocd; then
            get_argocd_info
        fi
        ;;
    status)
        check_status
        ;;
    pf-jenkins)
        check_minikube
        port_forward_jenkins
        ;;
    pf-argocd)
        check_minikube
        port_forward_argocd
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
