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
