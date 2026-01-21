# =============================================================================
# BFF Module - Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, staging, prod, minikube)"
  type        = string
  default     = "dev"
}

variable "namespace" {
  description = "Kubernetes namespace for BFF service"
  type        = string
  default     = "dev"
}

variable "create_namespace" {
  description = "Create the namespace if it doesn't exist"
  type        = bool
  default     = false
}

variable "release_name" {
  description = "Helm release name"
  type        = string
  default     = "bff-service"
}

variable "bff_enabled" {
  description = "Enable BFF service deployment"
  type        = bool
  default     = true
}

variable "chart_path" {
  description = "Path to the BFF Helm chart"
  type        = string
  default     = ""
}

variable "auth_mode" {
  description = "Auth mode: 'kong' (behind Kong, trust headers) or 'standalone' (validate JWT directly)"
  type        = string
  default     = "kong"

  validation {
    condition     = contains(["kong", "standalone"], var.auth_mode)
    error_message = "auth_mode must be either 'kong' or 'standalone'"
  }
}

# -----------------------------------------------------------------------------
# Image Configuration
# -----------------------------------------------------------------------------

variable "image_repository" {
  description = "Docker image repository"
  type        = string
  default     = "bff-service"
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "v1"
}

variable "image_pull_policy" {
  description = "Image pull policy"
  type        = string
  default     = "IfNotPresent"
}

# -----------------------------------------------------------------------------
# gRPC Service URLs
# -----------------------------------------------------------------------------

variable "user_service_url" {
  description = "User service gRPC URL"
  type        = string
  default     = "user-service.dev.svc.cluster.local:50051"
}

variable "task_service_url" {
  description = "Task service gRPC URL"
  type        = string
  default     = "task-service.dev.svc.cluster.local:50052"
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------

variable "redis_host" {
  description = "Redis host"
  type        = string
  default     = "redis-cluster-master.redis.svc.cluster.local"
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "redis_password" {
  description = "Redis password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "redis_db" {
  description = "Redis database number"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# Authentication
# -----------------------------------------------------------------------------

variable "jwt_secret" {
  description = "JWT secret for token validation (same as user-service)"
  type        = string
  sensitive   = true
  default     = ""
}

# -----------------------------------------------------------------------------
# Rate Limiting
# -----------------------------------------------------------------------------

variable "rate_limit_config" {
  description = "Rate limiting configuration"
  type = object({
    user_limit  = number
    user_window = number
    ip_limit    = number
    ip_window   = number
  })
  default = {
    user_limit  = 100
    user_window = 60
    ip_limit    = 50
    ip_window   = 60
  }
}

# -----------------------------------------------------------------------------
# Resources
# -----------------------------------------------------------------------------

variable "resources" {
  description = "Resource requests and limits"
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
  default = {
    requests = {
      cpu    = "100m"
      memory = "128Mi"
    }
    limits = {
      cpu    = "300m"
      memory = "256Mi"
    }
  }
}

variable "replica_count" {
  description = "Number of replicas"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# GraphQL Configuration
# -----------------------------------------------------------------------------

variable "graphql_playground" {
  description = "Enable GraphQL Playground"
  type        = bool
  default     = true
}

variable "graphql_introspection" {
  description = "Enable GraphQL introspection"
  type        = bool
  default     = true
}

variable "graphql_debug" {
  description = "Enable GraphQL debug mode"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# CORS
# -----------------------------------------------------------------------------

variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

# -----------------------------------------------------------------------------
# Ingress Configuration
# -----------------------------------------------------------------------------

variable "ingress_enabled" {
  description = "Enable ingress for BFF (disable when behind Kong)"
  type        = bool
  default     = false
}

variable "ingress_class" {
  description = "Ingress class name"
  type        = string
  default     = "nginx"
}

variable "ingress_host" {
  description = "Ingress hostname"
  type        = string
  default     = "bff.local"
}

variable "ingress_tls_enabled" {
  description = "Enable TLS for ingress"
  type        = bool
  default     = false
}

variable "ingress_tls_secret" {
  description = "TLS secret name"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Istio Integration
# -----------------------------------------------------------------------------

variable "istio_enabled" {
  description = "Enable Istio integration"
  type        = bool
  default     = false
}

variable "istio_mtls_mode" {
  description = "Istio mTLS mode (STRICT, PERMISSIVE, DISABLE)"
  type        = string
  default     = "STRICT"
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

variable "metrics_enabled" {
  description = "Enable Prometheus metrics"
  type        = bool
  default     = true
}

variable "service_monitor_labels" {
  description = "Labels for ServiceMonitor"
  type        = map(string)
  default = {
    release = "monitoring"
  }
}
