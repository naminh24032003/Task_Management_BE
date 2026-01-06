# =========================
# ArgoCD Configuration for Minikube
# =========================

module "argocd" {
  source = "../../modules/argocd"

  # Basic configuration
  namespace   = "argocd"
  environment = "dev"

  # Admin credentials
  admin_password = var.argocd_admin_password

  # Controller (optimized for Minikube)
  controller = {
    replica_count = 1
    resources = {
      requests = {
        cpu    = "100m"
        memory = "128Mi"
      }
      limits = {
        cpu    = "500m"
        memory = "512Mi"
      }
    }
  }

  # Server (UI/API)
  server = {
    resources = {
      requests = {
        cpu    = "50m"
        memory = "64Mi"
      }
      limits = {
        cpu    = "200m"
        memory = "256Mi"
      }
    }
  }

  # Repo Server
  repo_server = {
    resources = {
      requests = {
        cpu    = "50m"
        memory = "64Mi"
      }
      limits = {
        cpu    = "200m"
        memory = "256Mi"
      }
    }
  }

  # ApplicationSet Controller
  application_set = {
    resources = {
      requests = {
        cpu    = "50m"
        memory = "64Mi"
      }
      limits = {
        cpu    = "200m"
        memory = "256Mi"
      }
    }
  }

  # Notifications Controller
  notifications = {
    resources = {
      requests = {
        cpu    = "50m"
        memory = "64Mi"
      }
      limits = {
        cpu    = "200m"
        memory = "256Mi"
      }
    }
  }

  # Redis (external)
  redis = {
    enabled       = true
    password      = var.argocd_redis_password
    chart_version = "19.0.0"
    resources = {
      requests = {
        cpu    = "50m"
        memory = "64Mi"
      }
      limits = {
        cpu    = "200m"
        memory = "256Mi"
      }
    }
  }

  # Service configuration (NodePort for easy access in Minikube)
  service_type = "NodePort"

  # Ingress (disabled for basic Minikube setup)
  ingress = {
    enabled    = false
    hostname   = "argocd.local"
    class_name = "nginx"
    tls        = false
  }

  # Optional: Configure Git repositories
  git_repositories = var.argocd_git_repositories

  # Optional: Configure ArgoCD projects
  projects = var.argocd_projects
}

# =========================
# Outputs
# =========================
output "argocd_namespace" {
  description = "ArgoCD namespace"
  value       = module.argocd.namespace
}

output "argocd_url" {
  description = "ArgoCD internal URL"
  value       = module.argocd.argocd_url
}

output "argocd_service_name" {
  description = "ArgoCD server service name"
  value       = module.argocd.server_service_name
}

output "argocd_access_info" {
  description = "How to access ArgoCD in Minikube"
  value = <<-EOT
    To access ArgoCD:
    1. Get the NodePort:
       kubectl get svc -n ${module.argocd.namespace} ${module.argocd.server_service_name} -o jsonpath='{.spec.ports[0].nodePort}'

    2. Get Minikube IP:
       minikube ip

    3. Access ArgoCD at: http://<minikube-ip>:<node-port>

    Or use port forwarding:
       kubectl port-forward -n ${module.argocd.namespace} svc/${module.argocd.server_service_name} 8080:80
       Then access at: http://localhost:8080

    Login credentials:
       Username: ${module.argocd.admin_username}
       Password: <your-argocd-admin-password>

    Or via CLI:
       argocd login <argocd-url>
       argocd app list
  EOT
}