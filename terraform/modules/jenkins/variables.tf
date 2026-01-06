# =========================
# Jenkins Module Variables
# =========================

# Basic Configuration
variable "namespace" {
  type        = string
  description = "Kubernetes namespace for Jenkins"
  default     = "jenkins"
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  default     = "dev"
}

variable "release_name" {
  type        = string
  description = "Helm release name for Jenkins"
  default     = "jenkins"
}

variable "chart_version" {
  type        = string
  description = "Jenkins Helm chart version"
  default     = "13.4.18"
}

# Authentication
variable "jenkins_user" {
  type        = string
  description = "Jenkins admin username"
  default     = "admin"
}

variable "jenkins_password" {
  type        = string
  description = "Jenkins admin password"
  sensitive   = true
}

# Resources Configuration
variable "resources" {
  type = object({
    requests = object({
      cpu    = string
      memory = string
    })
    limits = object({
      cpu    = string
      memory = string
    })
  })
  description = "Resource requests and limits for Jenkins server"
  default = {
    requests = {
      cpu    = "500m"
      memory = "512Mi"
    }
    limits = {
      cpu    = "2000m"
      memory = "2048Mi"
    }
  }
}

variable "volume_permissions_resources" {
  type = object({
    requests = object({
      cpu    = string
      memory = string
    })
    limits = object({
      cpu    = string
      memory = string
    })
  })
  description = "Resource requests and limits for volume permissions init container"
  default = {
    requests = {
      cpu    = "16m"
      memory = "32Mi"
    }
    limits = {
      cpu    = "128m"
      memory = "256Mi"
    }
  }
}

# Persistence Configuration
variable "persistence" {
  type = object({
    enabled       = bool
    size          = string
    storage_class = string
  })
  description = "Persistence configuration for Jenkins"
  default = {
    enabled       = true
    size          = "8Gi"
    storage_class = ""
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
  description = "Ingress configuration for Jenkins"
  default = {
    enabled    = false
    hostname   = "jenkins.local"
    class_name = "nginx"
    tls        = false
  }
}

# Service Configuration
variable "service_type" {
  type        = string
  description = "Kubernetes service type for Jenkins"
  default     = "ClusterIP"
  validation {
    condition     = contains(["ClusterIP", "NodePort", "LoadBalancer"], var.service_type)
    error_message = "Service type must be ClusterIP, NodePort, or LoadBalancer."
  }
}

# Agent Configuration
variable "agent" {
  type = object({
    enabled       = bool
    container_cap = number
    node_selector = string
  })
  description = "Jenkins Kubernetes agent configuration"
  default = {
    enabled       = true
    container_cap = 10
    node_selector = ""
  }
}

# Init Scripts Configuration
variable "enable_init_scripts" {
  type        = bool
  description = "Enable Jenkins init groovy scripts"
  default     = false
}

variable "init_groovy_scripts" {
  type        = map(string)
  description = "Map of groovy script names to content for Jenkins initialization"
  default     = {}
}

variable "deployment_namespace" {
  type        = string
  description = "Namespace where Jenkins will deploy applications (for RBAC)"
  default     = ""
}

# Webhook Tokens (for CI/CD pipelines)
variable "webhook_tokens" {
  type        = map(string)
  description = "Map of webhook tokens for Jenkins pipelines"
  sensitive   = true
  default     = {}
}
