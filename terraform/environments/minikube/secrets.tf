# =========================
# Secrets Configuration
# =========================
# This file defines sensitive variables
# Values should be provided via secrets.auto.tfvars (gitignored)
# DO NOT commit secrets.auto.tfvars to version control!

# Jenkins Authentication
variable "jenkins_user" {
  type        = string
  description = "Jenkins admin username"
  sensitive   = false  # Username is not considered sensitive
  default     = "admin"
}

variable "jenkins_password" {
  type        = string
  description = "Jenkins admin password - MUST be provided in secrets.auto.tfvars"
  sensitive   = true

  validation {
    condition     = length(var.jenkins_password) >= 8
    error_message = "Jenkins password must be at least 8 characters long."
  }
}

# Future secrets can be added here
# Example:
# variable "github_token" {
#   type        = string
#   description = "GitHub personal access token for webhooks"
#   sensitive   = true
# }
#
# variable "docker_registry_password" {
#   type        = string
#   description = "Docker registry password"
#   sensitive   = true
# }