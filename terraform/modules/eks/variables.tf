variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.29"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs"
  type        = list(string)
}

variable "endpoint_public_access" {
  description = "Enable public access to EKS API endpoint"
  type        = bool
  default     = true
}

variable "enabled_log_types" {
  description = "EKS control plane logging types"
  type        = list(string)
  default     = ["api", "audit", "authenticator"]
}

# --- General Node Group ---
variable "general_instance_types" {
  description = "Instance types for general node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "general_capacity_type" {
  description = "Capacity type: ON_DEMAND or SPOT"
  type        = string
  default     = "ON_DEMAND"
}

variable "general_desired_size" {
  description = "Desired number of general nodes"
  type        = number
  default     = 2
}

variable "general_min_size" {
  description = "Minimum number of general nodes"
  type        = number
  default     = 1
}

variable "general_max_size" {
  description = "Maximum number of general nodes"
  type        = number
  default     = 4
}

# --- Platform Node Group ---
variable "enable_platform_nodegroup" {
  description = "Enable separate platform node group"
  type        = bool
  default     = true
}

variable "platform_instance_types" {
  description = "Instance types for platform node group (MongoDB, Kafka, Redis)"
  type        = list(string)
  default     = ["t3.large"]
}

variable "platform_desired_size" {
  description = "Desired number of platform nodes"
  type        = number
  default     = 2
}

variable "platform_min_size" {
  description = "Minimum number of platform nodes"
  type        = number
  default     = 1
}

variable "platform_max_size" {
  description = "Maximum number of platform nodes"
  type        = number
  default     = 3
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
