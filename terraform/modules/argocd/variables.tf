# =========================
# ArgoCD Module Variables
# =========================

# Basic Configuration
variable "namespace" {
  type        = string
  description = "Kubernetes namespace for ArgoCD"
  default     = "argocd"
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  default     = "dev"
}

variable "release_name" {
  type        = string
  description = "Helm release name for ArgoCD"
  default     = "argocd"
}

variable "chart_version" {
  type        = string
  description = "ArgoCD Helm chart version"
  default     = "6.6.0"
}

# Admin Credentials
variable "admin_password" {
  type        = string
  description = "ArgoCD admin password (will be bcrypt hashed)"
  sensitive   = true

  validation {
    condition     = length(var.admin_password) >= 8
    error_message = "ArgoCD admin password must be at least 8 characters long."
  }
}

# Service Configuration
variable "service_type" {
  type        = string
  description = "Kubernetes service type for ArgoCD server"
  default     = "ClusterIP"
  validation {
    condition     = contains(["ClusterIP", "NodePort", "LoadBalancer"], var.service_type)
    error_message = "Service type must be ClusterIP, NodePort, or LoadBalancer."
  }
}

# Ingress Configuration
variable "ingress" {
  type = object({
    enabled    = bool
    hostname   = string
    class_name = string
    tls        = bool
  })
  description = "Ingress configuration for ArgoCD"
  default = {
    enabled    = false
    hostname   = "argocd.local"
    class_name = "nginx"
    tls        = false
  }
}

# Controller Configuration
variable "controller" {
  type = object({
    replica_count = number
    resources = object({
      requests = object({
        cpu    = string
        memory = string
      })
      limits = object({
        cpu    = string
        memory = string
      })
    })
  })
  description = "ArgoCD application controller configuration"
  default = {
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
}

# Server Configuration
variable "server" {
  type = object({
    resources = object({
      requests = object({
        cpu    = string
        memory = string
      })
      limits = object({
        cpu    = string
        memory = string
      })
    })
  })
  description = "ArgoCD server configuration"
  default = {
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
}

# Repo Server Configuration
variable "repo_server" {
  type = object({
    resources = object({
      requests = object({
        cpu    = string
        memory = string
      })
      limits = object({
        cpu    = string
        memory = string
      })
    })
  })
  description = "ArgoCD repo server configuration"
  default = {
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
}

# ApplicationSet Controller Configuration
variable "application_set" {
  type = object({
    resources = object({
      requests = object({
        cpu    = string
        memory = string
      })
      limits = object({
        cpu    = string
        memory = string
      })
    })
  })
  description = "ArgoCD ApplicationSet controller configuration"
  default = {
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
}

# Notifications Controller Configuration
variable "notifications" {
  type = object({
    resources = object({
      requests = object({
        cpu    = string
        memory = string
      })
      limits = object({
        cpu    = string
        memory = string
      })
    })
  })
  description = "ArgoCD notifications controller configuration"
  default = {
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
}

# Redis Configuration
variable "redis" {
  type = object({
    enabled       = bool
    password      = string
    chart_version = string
    resources = object({
      requests = object({
        cpu    = string
        memory = string
      })
      limits = object({
        cpu    = string
        memory = string
      })
    })
  })
  description = "External Redis configuration for ArgoCD"
  sensitive   = true
  default = {
    enabled       = true
    password      = ""
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
}

# Git Repository Configuration (Optional)
variable "git_repositories" {
  type = map(object({
    url             = string
    username        = string
    ssh_private_key = string
    insecure        = bool
  }))
  description = "Map of Git repositories to configure in ArgoCD"
  sensitive   = true
  default     = {}
}

# ArgoCD Projects Configuration (Optional)
variable "projects" {
  type = map(object({
    description       = string
    source_repos      = list(string)
    destinations = list(object({
      server    = string
      namespace = string
    }))
  }))
  description = "Map of ArgoCD projects to create"
  default     = {}
}