# =============================================================================
# MongoDB Sharded Cluster Variables
# Based on mongo_shard/mongodb_sharded_variables.tf
# =============================================================================

# -----------------------------------------------------------------------------
# Basic Configuration
# -----------------------------------------------------------------------------
variable "namespace" {
  description = "Kubernetes namespace for MongoDB"
  type        = string
  default     = "mongodb"
}

variable "create_namespace" {
  description = "Create namespace if it doesn't exist"
  type        = bool
  default     = true
}

variable "release_name" {
  description = "Helm release name"
  type        = string
  default     = "mongodb-sharded"
}

variable "chart_version" {
  description = "MongoDB Sharded Helm chart version"
  type        = string
  default     = "9.2.4"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# -----------------------------------------------------------------------------
# Authentication
# -----------------------------------------------------------------------------
variable "root_password" {
  description = "Root password for MongoDB"
  type        = string
  sensitive   = true
}

variable "replica_set_key" {
  description = "Replica set key for MongoDB cluster"
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Cluster Configuration
# -----------------------------------------------------------------------------
variable "shard_count" {
  description = "Number of shards"
  type        = number
  default     = 1
}

variable "configsvr_replica_count" {
  description = "Number of config server replicas"
  type        = number
  default     = 1
}

variable "shardsvr_replica_count" {
  description = "Number of shard server replicas per shard"
  type        = number
  default     = 1
}

variable "mongos_replica_count" {
  description = "Number of mongos router replicas"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# Resource Presets
# Preset options: nano, micro, small, medium, large
# -----------------------------------------------------------------------------
variable "configsvr_resources_preset" {
  description = "Resource preset for config servers (nano, micro, small, medium, large)"
  type        = string
  default     = "nano"
}

variable "shardsvr_resources_preset" {
  description = "Resource preset for shard servers (nano, micro, small, medium, large)"
  type        = string
  default     = "micro"
}

variable "mongos_resources_preset" {
  description = "Resource preset for mongos routers (nano, micro, small, medium, large)"
  type        = string
  default     = "nano"
}

# -----------------------------------------------------------------------------
# Persistence Configuration
# -----------------------------------------------------------------------------
variable "persistence_enabled" {
  description = "Enable persistence using PVC"
  type        = bool
  default     = true
}

variable "storage_class" {
  description = "Storage class for PVC (empty string uses default)"
  type        = string
  default     = ""
}

variable "configsvr_persistence_size" {
  description = "PVC size for config servers"
  type        = string
  default     = "2Gi"
}

variable "shardsvr_persistence_size" {
  description = "PVC size for shard servers"
  type        = string
  default     = "8Gi"
}

# -----------------------------------------------------------------------------
# Image Configuration
# -----------------------------------------------------------------------------
variable "image_registry" {
  description = "Container image registry"
  type        = string
  default     = "docker.io"
}

variable "image_repository" {
  description = "Container image repository"
  type        = string
  default     = "bitnamilegacy/mongodb-sharded"
}

variable "image_tag" {
  description = "Container image tag"
  type        = string
  default     = "8.0.13-debian-12-r0"
}

variable "image_pull_policy" {
  description = "Image pull policy"
  type        = string
  default     = "IfNotPresent"
}

# -----------------------------------------------------------------------------
# Volume Permissions (for PV/PVC init)
# -----------------------------------------------------------------------------
variable "volume_permissions_enabled" {
  description = "Enable init container to set volume permissions"
  type        = bool
  default     = true
}

variable "volume_permissions_image_registry" {
  description = "Volume permissions init container image registry"
  type        = string
  default     = "docker.io"
}

variable "volume_permissions_image_repository" {
  description = "Volume permissions init container image repository"
  type        = string
  default     = "bitnamilegacy/os-shell"
}

variable "volume_permissions_image_tag" {
  description = "Volume permissions init container image tag"
  type        = string
  default     = "12-debian-12-r51"
}

# -----------------------------------------------------------------------------
# Network Configuration
# -----------------------------------------------------------------------------
variable "service_type" {
  description = "Kubernetes service type"
  type        = string
  default     = "ClusterIP"
}

variable "network_policy_enabled" {
  description = "Enable network policy"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Platform Configuration
# -----------------------------------------------------------------------------
variable "is_minikube" {
  description = "Running on minikube (disables node selectors)"
  type        = bool
  default     = true
}

variable "node_pool_label" {
  description = "Node pool label for node selector (ignored if is_minikube=true)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Metrics / Monitoring
# -----------------------------------------------------------------------------
variable "metrics_enabled" {
  description = "Enable Prometheus metrics"
  type        = bool
  default     = false
}
