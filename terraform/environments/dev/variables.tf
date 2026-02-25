# =============================================================================
# Dev Environment - Variables (Phase 1: Core Infrastructure)
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
