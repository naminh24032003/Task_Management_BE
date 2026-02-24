# =============================================================================
# Dev Environment - Variables
# =============================================================================

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "task-management"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

# --- Networking ---
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones"
  type        = number
  default     = 2
}

# --- EKS ---
variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.29"
}

variable "general_instance_types" {
  description = "Instance types for general workloads"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "general_capacity_type" {
  description = "ON_DEMAND or SPOT for general nodes"
  type        = string
  default     = "SPOT"
}

variable "general_desired_size" {
  type    = number
  default = 2
}

variable "general_min_size" {
  type    = number
  default = 1
}

variable "general_max_size" {
  type    = number
  default = 5
}

variable "enable_platform_nodegroup" {
  description = "Enable dedicated platform node group"
  type        = bool
  default     = true
}

variable "platform_instance_types" {
  description = "Instance types for platform services (MongoDB, Kafka, Redis)"
  type        = list(string)
  default     = ["t3.large"]
}

variable "platform_desired_size" {
  type    = number
  default = 2
}

variable "platform_min_size" {
  type    = number
  default = 2
}

variable "platform_max_size" {
  type    = number
  default = 4
}

# --- Feature Flags ---
variable "monitoring_enabled" {
  type    = bool
  default = true
}

variable "logging_enabled" {
  type    = bool
  default = true
}

variable "tracing_enabled" {
  type    = bool
  default = true
}

variable "tracing_sampling_rate" {
  type    = number
  default = 50
}

variable "mongodb_enabled" {
  type    = bool
  default = true
}

variable "kafka_enabled" {
  type    = bool
  default = true
}

variable "redis_enabled" {
  type    = bool
  default = true
}

variable "bff_enabled" {
  type    = bool
  default = true
}

variable "istio_enabled" {
  type    = bool
  default = false
}

# --- Secrets (pass via terraform.tfvars or env) ---
variable "mongodb_root_password" {
  description = "MongoDB root password"
  type        = string
  sensitive   = true
}

variable "mongodb_replica_set_key" {
  description = "MongoDB replica set key"
  type        = string
  sensitive   = true
}

variable "kafka_sasl_password" {
  description = "Kafka SASL password"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "Redis cluster password"
  type        = string
  sensitive   = true
}

variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  sensitive   = true
  default     = "admin"
}

variable "bff_jwt_secret" {
  description = "JWT secret for BFF service"
  type        = string
  sensitive   = true
}

variable "bff_redis_password" {
  description = "Redis password for BFF service"
  type        = string
  sensitive   = true
  default     = ""
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "api.taskmanagement.dev"
}

variable "cors_origins" {
  description = "CORS origins for BFF"
  type        = list(string)
  default     = ["https://taskmanagement.dev"]
}
