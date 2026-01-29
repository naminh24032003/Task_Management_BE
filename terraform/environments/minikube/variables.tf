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

variable "redis_commander_enabled" {
  type        = bool
  description = "Enable Redis Commander web UI for viewing cache data"
  default     = true
}

# =========================
# BFF Configuration
# =========================
variable "bff_enabled" {
  type        = bool
  description = "Enable BFF (GraphQL Gateway) service"
  default     = true
}

variable "bff_jwt_secret" {
  type        = string
  description = "JWT secret for BFF service (same as user-service)"
  default     = "dev-jwt-secret-for-local-testing-only"
  sensitive   = true
}

variable "bff_redis_password" {
  type        = string
  description = "Redis password for BFF service"
  default     = "Redis@Cluster2024Secure!"
  sensitive   = true
}

# =========================
# Tracing Configuration
# =========================
variable "tracing_enabled" {
  type        = bool
  description = "Enable distributed tracing (Tempo + OTEL Collector)"
  default     = true
}

variable "tracing_sampling_rate" {
  type        = number
  description = "Trace sampling rate (0.0 to 1.0)"
  default     = 1.0
}

# =========================
# Kafka Connect / Debezium (CDC)
# =========================
variable "kafka_connect_enabled" {
  type        = bool
  description = "Enable Kafka Connect with Debezium for CDC/Outbox Pattern"
  default     = false
}

variable "debezium_mongodb_uri" {
  type        = string
  description = "MongoDB connection string for Debezium"
  default     = "mongodb://task-mongodb-mongos.mongodb-task.svc.cluster.local:27017"
  sensitive   = true
}

variable "debezium_mongodb_user" {
  type        = string
  description = "MongoDB user for Debezium"
  default     = "root"
}

variable "debezium_mongodb_password" {
  type        = string
  description = "MongoDB password for Debezium"
  default     = ""
  sensitive   = true
}
