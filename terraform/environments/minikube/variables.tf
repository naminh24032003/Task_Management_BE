# =========================
# Minikube Environment Variables
# =========================
# Non-sensitive configuration variables
# Sensitive variables are defined in secrets.tf

# Jenkins Init Scripts
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
