# =============================================================================
# Istio - Namespace Configuration
# =============================================================================
# Manages namespaces and sidecar injection labels
# =============================================================================

# -----------------------------------------------------------------------------
# Istio System Namespace
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "istio_system" {
  count = var.istio_enabled ? 1 : 0

  metadata {
    name = var.istio_namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name" = "istio-system"
    })
  }
}

# -----------------------------------------------------------------------------
# Application Namespace - Enable Sidecar Injection
# -----------------------------------------------------------------------------

resource "kubernetes_labels" "namespace_injection" {
  count = var.istio_enabled ? 1 : 0

  api_version = "v1"
  kind        = "Namespace"
  metadata {
    name = var.namespace
  }
  labels = {
    "istio-injection" = "enabled"
  }
}

# -----------------------------------------------------------------------------
# Kong Namespace - Disable Sidecar Injection
# -----------------------------------------------------------------------------

resource "kubernetes_labels" "kong_no_injection" {
  count = var.istio_enabled && var.kong_exclude_from_mesh ? 1 : 0

  api_version = "v1"
  kind        = "Namespace"
  metadata {
    name = var.kong_namespace
  }
  labels = {
    "istio-injection" = "disabled"
  }
}
