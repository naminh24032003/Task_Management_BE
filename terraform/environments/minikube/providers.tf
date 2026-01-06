# =========================
# Terraform Providers Configuration
# =========================

terraform {
  required_version = ">= 1.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

# =========================
# Kubernetes Provider (Minikube)
# =========================
provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = "minikube"
}

# =========================
# Helm Provider
# =========================
provider "helm" {
  kubernetes {
    config_path    = "~/.kube/config"
    config_context = "minikube"
  }
}
