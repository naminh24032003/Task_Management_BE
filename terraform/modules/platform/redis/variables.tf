# =============================================================================
# Redis Cluster Module - Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------
variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
}

variable "namespace" {
  type        = string
  description = "Kubernetes namespace for Redis"
  default     = "redis"
}

variable "create_namespace" {
  type        = bool
  description = "Create the namespace if it doesn't exist"
  default     = true
}

variable "release_name" {
  type        = string
  description = "Helm release name for Redis"
  default     = "redis-cluster"
}

variable "chart_version" {
  type        = string
  description = "Redis Cluster Helm chart version (bitnami/redis-cluster)"
  default     = "11.0.7"
}

# -----------------------------------------------------------------------------
# Authentication
# -----------------------------------------------------------------------------
variable "redis_password" {
  type        = string
  description = "Password for Redis authentication"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Cluster Topology
# -----------------------------------------------------------------------------
variable "redis_nodes" {
  type        = number
  description = "Total number of Redis master nodes in the cluster"
  default     = 6
  validation {
    condition     = var.redis_nodes >= 3 && var.redis_nodes % 3 == 0
    error_message = "Redis nodes must be at least 3 and divisible by 3 for proper cluster setup."
  }
}

variable "redis_replicas" {
  type        = number
  description = "Number of replica nodes per Redis primary node"
  default     = 1
  validation {
    condition     = var.redis_replicas >= 0 && var.redis_replicas <= 5
    error_message = "Redis replicas must be between 0 and 5."
  }
}

# -----------------------------------------------------------------------------
# Resources
# -----------------------------------------------------------------------------
variable "redis_resources" {
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
  description = "Resource requests and limits for Redis nodes"
  default = {
    requests = {
      cpu    = "100m"
      memory = "256Mi"
    }
    limits = {
      cpu    = "200m"
      memory = "512Mi"
    }
  }
}

# -----------------------------------------------------------------------------
# Persistence
# -----------------------------------------------------------------------------
variable "persistence_enabled" {
  type        = bool
  description = "Enable persistent storage for Redis"
  default     = false
}

variable "persistence_size" {
  type        = string
  description = "Persistent volume size for each Redis node"
  default     = "2Gi"
}

variable "storage_class" {
  type        = string
  description = "Storage class for persistent volumes"
  default     = ""
}

# -----------------------------------------------------------------------------
# Platform Configuration
# -----------------------------------------------------------------------------
variable "is_minikube" {
  type        = bool
  description = "Whether running on Minikube (disables node selectors)"
  default     = false
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------
variable "maxmemory_policy" {
  type        = string
  description = "Redis maxmemory eviction policy"
  default     = "allkeys-lru"
  validation {
    condition = contains([
      "volatile-lru", "allkeys-lru", "volatile-lfu", "allkeys-lfu",
      "volatile-random", "allkeys-random", "volatile-ttl", "noeviction"
    ], var.maxmemory_policy)
    error_message = "Invalid maxmemory policy."
  }
}

variable "enable_metrics" {
  type        = bool
  description = "Enable Prometheus metrics exporter"
  default     = true
}

# -----------------------------------------------------------------------------
# Redis Commander UI
# -----------------------------------------------------------------------------
variable "enable_redis_commander" {
  type        = bool
  description = "Enable Redis Commander web UI for viewing cache data"
  default     = false
}

variable "redis_commander_resources" {
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
  description = "Resource requests and limits for Redis Commander"
  default = {
    requests = {
      cpu    = "50m"
      memory = "64Mi"
    }
    limits = {
      cpu    = "100m"
      memory = "128Mi"
    }
  }
}
