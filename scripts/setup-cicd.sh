#!/bin/bash
# =============================================================================
# Quick Setup Script for Jenkins + ArgoCD CI/CD
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# =============================================================================
# Step 1: Verify Jenkins and ArgoCD are running
# =============================================================================
verify_services() {
    print_header "Step 1: Verifying Services"

    print_info "Checking Jenkins..."
    if kubectl get pods -n jenkins | grep -q "jenkins-0.*Running"; then
        print_info "✅ Jenkins is running"
    else
        print_error "❌ Jenkins is not running. Please deploy Jenkins first."
        exit 1
    fi

    print_info "Checking ArgoCD..."
    if kubectl get pods -n argocd | grep -q "argocd-server.*Running"; then
        print_info "✅ ArgoCD is running"
    else
        print_error "❌ ArgoCD is not running. Please deploy ArgoCD first."
        exit 1
    fi

    echo ""
}

# =============================================================================
# Step 2: Get service URLs
# =============================================================================
get_service_urls() {
    print_header "Step 2: Service Access Information"

    MINIKUBE_IP=$(minikube ip)
    JENKINS_PORT=$(kubectl get svc jenkins -n jenkins -o jsonpath='{.spec.ports[0].nodePort}')
    ARGOCD_PORT=$(kubectl get svc argocd-server -n argocd -o jsonpath='{.spec.ports[0].nodePort}')
    ARGOCD_PASSWORD=$(kubectl get secret -n argocd argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

    echo -e "${GREEN}Jenkins URL:${NC} http://${MINIKUBE_IP}:${JENKINS_PORT}"
    echo -e "${GREEN}Jenkins Credentials:${NC} admin / Jenkins@2024Secure!"
    echo ""
    echo -e "${GREEN}ArgoCD URL:${NC} http://${MINIKUBE_IP}:${ARGOCD_PORT}"
    echo -e "${GREEN}ArgoCD Credentials:${NC} admin / ${ARGOCD_PASSWORD}"
    echo ""
}

# =============================================================================
# Step 3: Deploy ArgoCD Applications
# =============================================================================
deploy_argocd_apps() {
    print_header "Step 3: Deploy ArgoCD Applications"

    read -p "Do you want to deploy ArgoCD applications? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deploying user-service application..."
        kubectl apply -f angocd_template/user-service-app.yaml

        print_info "Deploying task-service application..."
        kubectl apply -f angocd_template/task-service-app.yaml

        print_info "✅ ArgoCD applications deployed"

        # Wait and check status
        sleep 5
        kubectl get applications -n argocd
    else
        print_warning "Skipping ArgoCD application deployment"
    fi

    echo ""
}

# =============================================================================
# Step 4: Instructions for Jenkins setup
# =============================================================================
jenkins_setup_instructions() {
    print_header "Step 4: Jenkins Configuration"

    echo -e "${YELLOW}Please configure Jenkins manually:${NC}"
    echo ""
    echo "1. Open Jenkins UI: http://${MINIKUBE_IP}:${JENKINS_PORT}"
    echo "   Login: admin / Jenkins@2024Secure!"
    echo ""
    echo "2. Add Docker Registry Credentials:"
    echo "   → Manage Jenkins → Credentials → System → Global credentials"
    echo "   → Add Credential (Username with password):"
    echo "     - ID: docker-registry-credentials"
    echo "     - Username: your-docker-username"
    echo "     - Password: your-docker-password"
    echo ""
    echo "   → Add Credential (Secret text):"
    echo "     - ID: docker-registry-url"
    echo "     - Secret: docker.io/your-username"
    echo ""
    echo "3. Create Pipeline Jobs:"
    echo "   → New Item → Pipeline"
    echo "   → Name: user-service-pipeline"
    echo "   → Pipeline script from SCM"
    echo "   → Repository: your-git-repo"
    echo "   → Script Path: service/user-service/Jenkinsfile"
    echo ""
    echo "   Repeat for task-service-pipeline"
    echo ""

    read -p "Press Enter when Jenkins is configured..."
    echo ""
}

# =============================================================================
# Step 5: Test deployment
# =============================================================================
test_deployment() {
    print_header "Step 5: Verify Current Deployments"

    print_info "Checking services in dev namespace..."
    kubectl get pods,svc -n dev
    echo ""

    print_info "Checking ArgoCD applications..."
    kubectl get applications -n argocd
    echo ""
}

# =============================================================================
# Step 6: Show next steps
# =============================================================================
show_next_steps() {
    print_header "🎉 Setup Complete!"

    echo -e "${GREEN}Next Steps:${NC}"
    echo ""
    echo "1. Configure Docker Registry in Jenkins (see Step 4 above)"
    echo ""
    echo "2. Update Git Repository URLs in ArgoCD applications:"
    echo "   Edit: angocd_template/user-service-app.yaml"
    echo "   Edit: angocd_template/task-service-app.yaml"
    echo "   Replace: https://github.com/your-org/task-management-be.git"
    echo ""
    echo "3. Test the pipeline:"
    echo "   cd service/user-service"
    echo "   # Make a change"
    echo "   git commit -am 'test: trigger pipeline'"
    echo "   git push origin main"
    echo ""
    echo "4. Monitor the flow:"
    echo "   - Jenkins: http://${MINIKUBE_IP}:${JENKINS_PORT}"
    echo "   - ArgoCD: http://${MINIKUBE_IP}:${ARGOCD_PORT}"
    echo "   - Kubernetes: kubectl get pods -n dev -w"
    echo ""
    echo -e "${BLUE}📚 Documentation:${NC}"
    echo "   - CI_CD_SETUP.md - Complete guide"
    echo "   - JENKINS_ARGOCD_ACCESS.md - Access information"
    echo "   - DEPLOYMENT_SUMMARY.md - Deployment overview"
    echo ""
}

# =============================================================================
# Main execution
# =============================================================================
main() {
    print_header "Jenkins + ArgoCD CI/CD Setup"
    echo ""

    verify_services
    get_service_urls
    deploy_argocd_apps
    jenkins_setup_instructions
    test_deployment
    show_next_steps
}

main
