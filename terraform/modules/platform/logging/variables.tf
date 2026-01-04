# =============================================================================
# Logging Module Variables
# =============================================================================
# This module deploys the logging stack (Loki + Promtail)
# =============================================================================

# =============================================================================
# General Configuration
# =============================================================================

variable "namespace" {
  type        = string
  description = "Kubernetes namespace for logging stack"
  default     = "logging"
}

variable "create_namespace" {
  type        = bool
  description = "Whether to create the namespace"
  default     = true
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  default     = "dev"
}

# =============================================================================
# Loki Configuration
# =============================================================================

variable "loki_enabled" {
  type        = bool
  description = "Enable Loki deployment"
  default     = true
}

variable "loki_chart_version" {
  type        = string
  description = "Loki-stack Helm chart version"
  default     = "2.10.2"
}

variable "loki_storage_size" {
  type        = string
  description = "Loki persistent storage size"
  default     = "10Gi"
}

variable "loki_storage_enabled" {
  type        = bool
  description = "Enable persistent storage for Loki"
  default     = true
}

variable "loki_storage_class" {
  type        = string
  description = "Storage class for Loki PVC"
  default     = "standard"
}

variable "loki_retention_period" {
  type        = string
  description = "Log retention period"
  default     = "168h"
}

variable "loki_resources" {
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
  description = "Resource requests and limits for Loki"
  default = {
    requests = {
      cpu    = "100m"
      memory = "256Mi"
    }
    limits = {
      cpu    = "500m"
      memory = "1Gi"
    }
  }
}

# =============================================================================
# Promtail Configuration
# =============================================================================

variable "promtail_enabled" {
  type        = bool
  description = "Enable Promtail deployment"
  default     = true
}

variable "promtail_resources" {
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
  description = "Resource requests and limits for Promtail"
  default = {
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

# =============================================================================
# Grafana Integration
# =============================================================================

variable "grafana_datasource_enabled" {
  type        = bool
  description = "Create Grafana datasource ConfigMap for Loki"
  default     = true
}

variable "grafana_namespace" {
  type        = string
  description = "Grafana namespace for datasource ConfigMap"
  default     = "monitoring"
}
