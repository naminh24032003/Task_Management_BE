# =========================
# Minikube Environment Variables
# =========================
# Non-sensitive configuration variables
# Sensitive variables are defined in secrets.tf

# =========================
# General Configuration
# =========================
variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  default     = "dev"
}

# =========================
# Platform Component Toggles
# =========================
variable "monitoring_enabled" {
  type        = bool
  description = "Enable monitoring stack (Prometheus + Grafana)"
  default     = true
}

variable "logging_enabled" {
  type        = bool
  description = "Enable logging stack (Loki + Promtail)"
  default     = true
}

variable "istio_enabled" {
  type        = bool
  description = "Enable Istio service mesh"
  default     = true
}

variable "mongodb_enabled" {
  type        = bool
  description = "Enable MongoDB sharded cluster"
  default     = false
}

variable "mongodb_persistence_enabled" {
  type        = bool
  description = "Enable persistence for MongoDB"
  default     = false
}

variable "mongodb_metrics_enabled" {
  type        = bool
  description = "Enable metrics for MongoDB"
  default     = false
}

variable "mongodb_root_password" {
  type        = string
  description = "MongoDB root password"
  default     = "mongodb-root-password"
  sensitive   = true
}

variable "mongodb_replica_set_key" {
  type        = string
  description = "MongoDB replica set key"
  default     = "mongodb-replica-key"
  sensitive   = true
}

# =========================
# Jenkins Configuration
# =========================
variable "enable_jenkins_init_scripts" {
  type        = bool
  description = "Enable Jenkins init groovy scripts"
  default     = false
}

variable "jenkins_deployment_namespace" {
  type        = string
  description = "Namespace where Jenkins will deploy applications"
  default     = "default"
}

# =========================
# Kafka Configuration
# =========================
variable "kafka_enabled" {
  type        = bool
  description = "Enable Kafka cluster"
  default     = false
}

variable "kafka_persistence_enabled" {
  type        = bool
  description = "Enable persistence for Kafka"
  default     = false
}

# =========================
# Redis Configuration
# =========================
variable "redis_enabled" {
  type        = bool
  description = "Enable Redis cluster"
  default     = false
}

variable "redis_persistence_enabled" {
  type        = bool
  description = "Enable persistence for Redis"
  default     = false
}
