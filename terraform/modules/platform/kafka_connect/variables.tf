# =============================================================================
# Kafka Connect Module - Variables
# =============================================================================

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace for Kafka Connect"
  type        = string
  default     = "kafka-connect"
}

variable "create_namespace" {
  description = "Whether to create the namespace"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Debezium Image
# -----------------------------------------------------------------------------

variable "debezium_image" {
  description = "Debezium Connect image with MongoDB connector"
  type        = string
  default     = "debezium/connect:2.5"
}

variable "replicas" {
  description = "Number of Kafka Connect replicas"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# Kafka Configuration
# -----------------------------------------------------------------------------

variable "kafka_bootstrap_servers" {
  description = "Kafka bootstrap servers"
  type        = string
}

variable "kafka_sasl_username" {
  description = "Kafka SASL username"
  type        = string
}

variable "kafka_sasl_password" {
  description = "Kafka SASL password"
  type        = string
  sensitive   = true
}

variable "connect_group_id" {
  description = "Kafka Connect cluster group ID"
  type        = string
  default     = "task-service-connect"
}

variable "config_storage_topic" {
  description = "Topic for connector configs"
  type        = string
  default     = "connect-configs"
}

variable "offset_storage_topic" {
  description = "Topic for connector offsets"
  type        = string
  default     = "connect-offsets"
}

variable "status_storage_topic" {
  description = "Topic for connector status"
  type        = string
  default     = "connect-status"
}

# -----------------------------------------------------------------------------
# MongoDB Configuration
# -----------------------------------------------------------------------------

variable "mongodb_connection_string" {
  description = "MongoDB connection string"
  type        = string
  sensitive   = true
}

variable "mongodb_user" {
  description = "MongoDB username"
  type        = string
}

variable "mongodb_password" {
  description = "MongoDB password"
  type        = string
  sensitive   = true
}

variable "mongodb_database" {
  description = "MongoDB database name"
  type        = string
  default     = "task-service"
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
    requests = { cpu = "200m", memory = "512Mi" }
    limits   = { cpu = "1000m", memory = "1Gi" }
  }
}

# -----------------------------------------------------------------------------
# Platform
# -----------------------------------------------------------------------------

variable "is_minikube" {
  description = "Whether running on Minikube"
  type        = bool
  default     = false
}
