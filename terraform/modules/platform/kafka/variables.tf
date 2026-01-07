# =============================================================================
# Kafka Module - Variables
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
  description = "Kubernetes namespace for Kafka"
  default     = "kafka"
}

variable "create_namespace" {
  type        = bool
  description = "Create the namespace if it doesn't exist"
  default     = true
}

variable "release_name" {
  type        = string
  description = "Helm release name for Kafka"
  default     = "kafka"
}

variable "chart_version" {
  type        = string
  description = "Kafka Helm chart version"
  default     = "31.0.0"
}

# -----------------------------------------------------------------------------
# Authentication
# -----------------------------------------------------------------------------
variable "sasl_user" {
  type        = string
  description = "SASL username for Kafka authentication"
  default     = "kafka-user"
}

variable "sasl_password" {
  type        = string
  description = "SASL password for Kafka authentication"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Controller Configuration (KRaft mode)
# -----------------------------------------------------------------------------
variable "controller_replica_count" {
  type        = number
  description = "Number of Kafka controller replicas"
  default     = 1
}

variable "controller_resources" {
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
  description = "Resource requests and limits for Kafka controllers"
  default = {
    requests = {
      cpu    = "100m"
      memory = "256Mi"
    }
    limits = {
      cpu    = "500m"
      memory = "512Mi"
    }
  }
}

variable "controller_persistence_size" {
  type        = string
  description = "Persistent volume size for controller data"
  default     = "2Gi"
}

variable "controller_log_persistence_size" {
  type        = string
  description = "Persistent volume size for controller logs"
  default     = "1Gi"
}

# -----------------------------------------------------------------------------
# Broker Configuration
# -----------------------------------------------------------------------------
variable "broker_replica_count" {
  type        = number
  description = "Number of Kafka broker replicas (0 for KRaft mode)"
  default     = 0
}

variable "broker_resources" {
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
  description = "Resource requests and limits for Kafka brokers"
  default = {
    requests = {
      cpu    = "100m"
      memory = "256Mi"
    }
    limits = {
      cpu    = "500m"
      memory = "512Mi"
    }
  }
}

# -----------------------------------------------------------------------------
# Storage Configuration
# -----------------------------------------------------------------------------
variable "persistence_enabled" {
  type        = bool
  description = "Enable persistent storage for Kafka"
  default     = false
}

variable "storage_class" {
  type        = string
  description = "Storage class for persistent volumes"
  default     = ""
}

# -----------------------------------------------------------------------------
# Volume Permissions
# -----------------------------------------------------------------------------
variable "volume_permissions_enabled" {
  type        = bool
  description = "Enable volume permissions init container"
  default     = true
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
  description = "Resource requests and limits for volume permissions container"
  default = {
    requests = {
      cpu    = "10m"
      memory = "32Mi"
    }
    limits = {
      cpu    = "50m"
      memory = "64Mi"
    }
  }
}

# -----------------------------------------------------------------------------
# Kafka UI Configuration
# -----------------------------------------------------------------------------
variable "kafka_ui_enabled" {
  type        = bool
  description = "Enable Kafka UI deployment"
  default     = true
}

variable "kafka_ui_image" {
  type        = string
  description = "Kafka UI Docker image"
  default     = "provectuslabs/kafka-ui:latest"
}

variable "kafka_ui_resources" {
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
  description = "Resource requests and limits for Kafka UI"
  default = {
    requests = {
      cpu    = "50m"
      memory = "128Mi"
    }
    limits = {
      cpu    = "200m"
      memory = "256Mi"
    }
  }
}

# -----------------------------------------------------------------------------
# Network Configuration
# -----------------------------------------------------------------------------
variable "service_type" {
  type        = string
  description = "Kubernetes service type"
  default     = "ClusterIP"
}

# -----------------------------------------------------------------------------
# Platform Configuration
# -----------------------------------------------------------------------------
variable "is_minikube" {
  type        = bool
  description = "Whether running on Minikube (disables node selectors)"
  default     = false
}
