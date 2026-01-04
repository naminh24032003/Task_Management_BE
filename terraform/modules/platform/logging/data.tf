# =============================================================================
# Logging - Data Sources
# =============================================================================

data "kubernetes_service" "loki" {
  count = var.loki_enabled ? 1 : 0

  metadata {
    name      = local.loki_service
    namespace = var.namespace
  }

  depends_on = [helm_release.loki_stack]
}
