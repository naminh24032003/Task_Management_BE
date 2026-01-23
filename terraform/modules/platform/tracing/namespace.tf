# =============================================================================
# Tracing Module - Namespace
# =============================================================================

resource "kubernetes_namespace" "tracing" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name = var.namespace

    labels = merge(local.common_labels, {
      "name" = var.namespace
    })
  }
}
