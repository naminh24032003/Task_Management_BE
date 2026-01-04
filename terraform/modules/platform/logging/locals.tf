# =============================================================================
# Logging Module - Local Variables
# =============================================================================

locals {
  # Helm release naming
  release_name = "logging"
  
  # Service names (created by loki-stack chart)
  loki_service = "${local.release_name}-loki"
  
  # Common labels
  common_labels = {
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  }
}
