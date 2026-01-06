# =========================
# ArgoCD Secrets Configuration
# =========================
# This file defines sensitive variables for ArgoCD
# Values should be provided via secrets.auto.tfvars (gitignored)
# DO NOT commit secrets.auto.tfvars to version control!

# ArgoCD Admin Password
variable "argocd_admin_password" {
  type        = string
  description = "ArgoCD admin password - MUST be provided in secrets.auto.tfvars"
  sensitive   = true

  validation {
    condition     = length(var.argocd_admin_password) >= 8
    error_message = "ArgoCD admin password must be at least 8 characters long."
  }
}

# Redis Password
variable "argocd_redis_password" {
  type        = string
  description = "Redis password for ArgoCD - MUST be provided in secrets.auto.tfvars"
  sensitive   = true

  validation {
    condition     = length(var.argocd_redis_password) >= 8
    error_message = "Redis password must be at least 8 characters long."
  }
}

# Git Repository Configurations (Optional)
variable "argocd_git_repositories" {
  type = map(object({
    url             = string
    username        = string
    ssh_private_key = string
    insecure        = bool
  }))
  description = "Git repositories for ArgoCD (configure in secrets.auto.tfvars if needed)"
  sensitive   = true
  default     = {}
}

# ArgoCD Projects (Optional)
variable "argocd_projects" {
  type = map(object({
    description  = string
    source_repos = list(string)
    destinations = list(object({
      server    = string
      namespace = string
    }))
  }))
  description = "ArgoCD projects configuration"
  default     = {}
}