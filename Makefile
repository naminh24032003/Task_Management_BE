.PHONY: help init plan apply destroy deploy clean lint test

# Variables
ENV ?= dev
AWS_REGION ?= us-east-1
TERRAFORM_DIR = terraform/environments/$(ENV)
HELM_DIR = helm-charts

# Colors
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(GREEN)Task Management Platform - Makefile Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "$(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

# Terraform Commands
tf-init: ## Initialize Terraform
	@echo "$(GREEN)Initializing Terraform for $(ENV) environment...$(NC)"
	cd $(TERRAFORM_DIR) && terraform init

tf-plan: ## Run Terraform plan
	@echo "$(GREEN)Planning Terraform changes for $(ENV) environment...$(NC)"
	cd $(TERRAFORM_DIR) && terraform plan -out=tfplan

tf-apply: ## Apply Terraform changes
	@echo "$(GREEN)Applying Terraform changes for $(ENV) environment...$(NC)"
	cd $(TERRAFORM_DIR) && terraform apply tfplan

tf-destroy: ## Destroy Terraform infrastructure
	@echo "$(RED)Destroying Terraform infrastructure for $(ENV) environment...$(NC)"
	@read -p "Are you sure? Type 'yes' to confirm: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		cd $(TERRAFORM_DIR) && terraform destroy; \
	else \
		echo "Aborted."; \
	fi

tf-output: ## Show Terraform outputs
	cd $(TERRAFORM_DIR) && terraform output

# Kubernetes Commands
k8s-config: ## Configure kubectl for EKS cluster
	@echo "$(GREEN)Configuring kubectl for $(ENV) environment...$(NC)"
	./scripts/setup-kubeconfig.sh $(ENV)

k8s-status: ## Show Kubernetes cluster status
	kubectl get nodes
	kubectl get pods --all-namespaces

# Helm Commands
helm-lint: ## Lint all Helm charts
	@echo "$(GREEN)Linting Helm charts...$(NC)"
	helm lint $(HELM_DIR)/charts/infrastructure
	helm lint $(HELM_DIR)/charts/observability
	helm lint $(HELM_DIR)/charts/microservice
	helm lint $(HELM_DIR)/services/task-service
	helm lint $(HELM_DIR)/services/user-service
	helm lint $(HELM_DIR)/umbrella-chart

helm-template: ## Render Helm templates
	@echo "$(GREEN)Rendering Helm templates for $(ENV) environment...$(NC)"
	helm template test $(HELM_DIR)/umbrella-chart -f $(HELM_DIR)/umbrella-chart/values/values-$(ENV).yaml

helm-deploy-infra: ## Deploy infrastructure chart
	@echo "$(GREEN)Deploying infrastructure chart to $(ENV)...$(NC)"
	helm upgrade --install infrastructure $(HELM_DIR)/charts/infrastructure \
		-f $(HELM_DIR)/charts/infrastructure/values/values-$(ENV).yaml \
		-n $(ENV) \
		--create-namespace \
		--wait \
		--timeout 10m

helm-deploy-observability: ## Deploy observability chart
	@echo "$(GREEN)Deploying observability chart to $(ENV)...$(NC)"
	helm upgrade --install observability $(HELM_DIR)/charts/observability \
		-n $(ENV) \
		--wait \
		--timeout 10m

helm-deploy-services: ## Deploy all microservices
	@echo "$(GREEN)Deploying microservices to $(ENV)...$(NC)"
	helm upgrade --install task-service $(HELM_DIR)/services/task-service \
		-f $(HELM_DIR)/services/task-service/values/values-$(ENV).yaml \
		-n $(ENV) \
		--wait
	helm upgrade --install user-service $(HELM_DIR)/services/user-service \
		-f $(HELM_DIR)/services/user-service/values/values-$(ENV).yaml \
		-n $(ENV) \
		--wait

helm-deploy-all: helm-deploy-infra helm-deploy-observability helm-deploy-services ## Deploy all Helm charts

helm-uninstall: ## Uninstall all Helm releases
	@echo "$(RED)Uninstalling Helm releases from $(ENV)...$(NC)"
	helm uninstall user-service -n $(ENV) --ignore-not-found
	helm uninstall task-service -n $(ENV) --ignore-not-found
	helm uninstall observability -n $(ENV) --ignore-not-found
	helm uninstall infrastructure -n $(ENV) --ignore-not-found

# Full Deployment
deploy: tf-init tf-plan tf-apply k8s-config helm-deploy-all ## Full deployment (Terraform + Helm)
	@echo "$(GREEN)✓ Deployment completed successfully!$(NC)"

destroy: helm-uninstall tf-destroy ## Full destruction (Helm + Terraform)
	@echo "$(RED)Environment $(ENV) destroyed.$(NC)"

# Development Commands
dev-setup: ## Setup local development environment
	@echo "$(GREEN)Setting up local development environment...$(NC)"
	docker-compose -f local-dev/docker-compose.yml up -d

dev-down: ## Stop local development environment
	docker-compose -f local-dev/docker-compose.yml down

# Monitoring
logs: ## Tail logs from a service (usage: make logs SERVICE=task-service)
	kubectl logs -f deployment/$(SERVICE)-microservice -n $(ENV)

port-forward-prometheus: ## Port forward Prometheus
	kubectl port-forward -n $(ENV) svc/observability-prometheus 9090:9090

port-forward-grafana: ## Port forward Grafana
	kubectl port-forward -n $(ENV) svc/observability-grafana 3000:3000

port-forward-jaeger: ## Port forward Jaeger
	kubectl port-forward -n $(ENV) svc/observability-jaeger 16686:16686

# Validation
validate: ## Validate all configurations
	@echo "$(GREEN)Validating configurations...$(NC)"
	cd $(TERRAFORM_DIR) && terraform fmt -check && terraform validate
	$(MAKE) helm-lint

format: ## Format Terraform files
	@echo "$(GREEN)Formatting Terraform files...$(NC)"
	terraform fmt -recursive terraform/

clean: ## Clean temporary files
	find . -type f -name "*.tfplan" -delete
	find . -type d -name ".terraform" -exec rm -rf {} + 2>/dev/null || true
	@echo "$(GREEN)Cleaned temporary files$(NC)"

# Quick commands for specific environments
dev: ENV=dev deploy ## Deploy to dev environment
staging: ENV=staging deploy ## Deploy to staging environment
production: ENV=production deploy ## Deploy to production environment

# Testing
test: ## Run tests
	@echo "$(YELLOW)Running tests...$(NC)"
	# Add your test commands here

.DEFAULT_GOAL := help
