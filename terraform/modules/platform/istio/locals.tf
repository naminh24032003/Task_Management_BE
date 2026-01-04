# =============================================================================
# Istio Module - Local Variables
# =============================================================================

locals {
  # Common labels for all resources
  common_labels = {
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  }
  
  # Service list for iteration
  service_names = keys(var.services)
}
