# =============================================================================
# Logging - Namespace
# =============================================================================

resource "kubernetes_namespace" "logging" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name" = "logging"
    })
  }
}
