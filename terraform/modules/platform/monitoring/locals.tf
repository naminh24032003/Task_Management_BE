# =============================================================================
# Monitoring Module - Local Variables
# =============================================================================

locals {
  # Helm release naming
  release_name = "monitoring"
  
  # Service names (created by kube-prometheus-stack chart)
  prometheus_service   = "${local.release_name}-kube-prometheus-prometheus"
  alertmanager_service = "${local.release_name}-kube-prometheus-alertmanager"
  grafana_service      = "${local.release_name}-grafana"
  
  # Common labels
  common_labels = {
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  }
}
