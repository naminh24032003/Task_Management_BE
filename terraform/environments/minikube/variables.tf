# =============================================================================
# Minikube Environment - Variables
# =============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

# Monitoring
variable "monitoring_enabled" {
  description = "Enable monitoring stack"
  type        = bool
  default     = true
}

# Logging  
variable "logging_enabled" {
  description = "Enable logging stack"
  type        = bool
  default     = true
}

# Istio
variable "istio_enabled" {
  description = "Enable Istio service mesh"
  type        = bool
  default     = true
}

# =============================================================================
# MongoDB Sharded Configuration
# =============================================================================

variable "mongodb_enabled" {
  description = "Enable MongoDB Sharded cluster"
  type        = bool
  default     = true
}

variable "mongodb_root_password" {
  description = "MongoDB root password"
  type        = string
  default     = "mongodb-password"  # Change in production!
  sensitive   = true
}

variable "mongodb_replica_set_key" {
  description = "MongoDB replica set key"
  type        = string
  default     = "OP6XsccLjf3751U4pngAcoutAoFqIEzk"
  sensitive   = true
}

variable "mongodb_persistence_enabled" {
  description = "Enable persistence for MongoDB (requires PV provisioner)"
  type        = bool
  default     = true  # Set to false if minikube doesn't have storage provisioner
}

variable "mongodb_metrics_enabled" {
  description = "Enable MongoDB metrics exporter"
  type        = bool
  default     = false  # Enable if you want Prometheus metrics
}
