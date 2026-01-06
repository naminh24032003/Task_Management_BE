# Makefile for Jenkins Minikube Environment
# Quick commands to manage Jenkins deployment

.PHONY: help init plan apply destroy status logs clean port-forward access

# Default target
help: ## Show this help message
	@echo "Jenkins Minikube Management"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup-secrets: ## Setup secrets file from example
	@if [ ! -f secrets.auto.tfvars ]; then \
		cp secrets.auto.tfvars.example secrets.auto.tfvars; \
		echo "✅ Created secrets.auto.tfvars"; \
		echo "⚠️  IMPORTANT: Edit secrets.auto.tfvars and set your actual secrets!"; \
		echo "Run: nano secrets.auto.tfvars"; \
	else \
		echo "✅ secrets.auto.tfvars already exists"; \
	fi

check-secrets: ## Check if secrets are properly configured
	@if [ ! -f secrets.auto.tfvars ]; then \
		echo "❌ secrets.auto.tfvars not found!"; \
		echo "Run: make setup-secrets"; \
		exit 1; \
	fi
	@if grep -q "CHANGE-ME" secrets.auto.tfvars 2>/dev/null; then \
		echo "⚠️  Warning: Default password detected!"; \
		echo "Please update secrets.auto.tfvars with your actual password"; \
		exit 1; \
	fi
	@echo "✅ Secrets file configured"

init: check-secrets ## Initialize Terraform
	@echo "Initializing Terraform..."
	terraform init

plan: check-secrets ## Plan Terraform changes
	@echo "Planning Terraform changes..."
	terraform plan

apply: check-secrets ## Apply Terraform configuration
	@echo "Applying Terraform configuration..."
	terraform apply

apply-auto: ## Apply without confirmation (use with caution!)
	@echo "Auto-applying Terraform configuration..."
	terraform apply -auto-approve

destroy: ## Destroy Jenkins infrastructure
	@echo "Destroying Jenkins infrastructure..."
	terraform destroy

destroy-auto: ## Destroy without confirmation (use with caution!)
	@echo "Auto-destroying Jenkins infrastructure..."
	terraform destroy -auto-approve

status: ## Check Jenkins pod status
	@echo "Checking Jenkins status..."
	@kubectl get all -n jenkins
	@echo ""
	@echo "PVC Status:"
	@kubectl get pvc -n jenkins

logs: ## Show Jenkins logs
	@echo "Fetching Jenkins logs..."
	@kubectl logs -n jenkins -l app.kubernetes.io/name=jenkins --tail=100 -f

logs-all: ## Show all Jenkins logs
	@kubectl logs -n jenkins -l app.kubernetes.io/name=jenkins

describe: ## Describe Jenkins pod
	@kubectl describe pod -n jenkins -l app.kubernetes.io/name=jenkins

events: ## Show Jenkins namespace events
	@kubectl get events -n jenkins --sort-by='.lastTimestamp'

port-forward: ## Port forward Jenkins to localhost:8080
	@echo "Port forwarding Jenkins to http://localhost:8080"
	@echo "Press Ctrl+C to stop"
	@kubectl port-forward -n jenkins svc/jenkins 8080:80

access: ## Get Jenkins access URL and credentials
	@echo "=== Jenkins Access Information ==="
	@echo ""
	@echo "Getting Minikube IP..."
	@MINIKUBE_IP=$$(minikube ip); \
	NODE_PORT=$$(kubectl get svc -n jenkins jenkins -o jsonpath='{.spec.ports[0].nodePort}'); \
	echo "Jenkins URL: http://$$MINIKUBE_IP:$$NODE_PORT"; \
	echo ""; \
	echo "Username: admin"; \
	echo "Password: (check your terraform.tfvars)"; \
	echo ""; \
	echo "Or use: minikube service jenkins -n jenkins"

service: ## Open Jenkins using minikube service
	@echo "Opening Jenkins in browser..."
	@minikube service jenkins -n jenkins

restart: ## Restart Jenkins deployment
	@echo "Restarting Jenkins..."
	@kubectl rollout restart deployment -n jenkins jenkins
	@echo "Waiting for rollout to complete..."
	@kubectl rollout status deployment -n jenkins jenkins

shell: ## Get shell access to Jenkins pod
	@echo "Getting shell access to Jenkins pod..."
	@kubectl exec -it -n jenkins $$(kubectl get pod -n jenkins -l app.kubernetes.io/name=jenkins -o jsonpath='{.items[0].metadata.name}') -- /bin/bash

backup: ## Backup Jenkins data
	@echo "Backing up Jenkins data..."
	@POD_NAME=$$(kubectl get pod -n jenkins -l app.kubernetes.io/name=jenkins -o jsonpath='{.items[0].metadata.name}'); \
	kubectl exec -n jenkins $$POD_NAME -- tar czf /tmp/jenkins-backup.tar.gz /bitnami/jenkins/home; \
	kubectl cp jenkins/$$POD_NAME:/tmp/jenkins-backup.tar.gz ./jenkins-backup-$$(date +%Y%m%d-%H%M%S).tar.gz; \
	echo "Backup saved to: jenkins-backup-$$(date +%Y%m%d-%H%M%S).tar.gz"

clean: ## Clean Terraform state
	@echo "Cleaning Terraform state..."
	@rm -rf .terraform
	@rm -f .terraform.lock.hcl
	@rm -f terraform.tfstate*
	@echo "Clean complete. Run 'make init' to reinitialize."

validate: ## Validate Terraform configuration
	@echo "Validating Terraform configuration..."
	@terraform validate

fmt: ## Format Terraform files
	@echo "Formatting Terraform files..."
	@terraform fmt -recursive

output: ## Show Terraform outputs
	@echo "Terraform outputs:"
	@terraform output

# Development helpers
dev-setup: setup-secrets ## Complete dev setup (secrets + init + apply)
	@echo "Setting up Jenkins development environment..."
	@make check-secrets
	@make init
	@make apply

dev-reset: ## Reset development environment (destroy + clean + init + apply)
	@echo "Resetting development environment..."
	@make destroy-auto
	@make clean
	@make init
	@make apply-auto

# Monitoring
watch: ## Watch Jenkins pods status
	@watch -n 2 kubectl get pods -n jenkins

top: ## Show resource usage
	@kubectl top pods -n jenkins

# Quick checks
check-minikube: ## Check if Minikube is running
	@echo "Checking Minikube status..."
	@minikube status

check-context: ## Check current kubectl context
	@echo "Current kubectl context:"
	@kubectl config current-context

# Install dependencies
install-deps: ## Install required tools (macOS/Linux)
	@echo "Checking dependencies..."
	@command -v terraform >/dev/null 2>&1 || { echo "Terraform not installed!"; exit 1; }
	@command -v kubectl >/dev/null 2>&1 || { echo "kubectl not installed!"; exit 1; }
	@command -v helm >/dev/null 2>&1 || { echo "Helm not installed!"; exit 1; }
	@command -v minikube >/dev/null 2>&1 || { echo "Minikube not installed!"; exit 1; }
	@echo "All dependencies installed!"

# Full workflow
full-setup: check-minikube install-deps dev-setup access ## Complete setup from scratch

# Utilities
get-password: ## Extract Jenkins password from tfvars
	@grep jenkins_password terraform.tfvars | cut -d'"' -f2 || echo "Password not found in terraform.tfvars"

config: ## Show current configuration
	@echo "=== Current Configuration ==="
	@cat terraform.tfvars 2>/dev/null || echo "No terraform.tfvars found"