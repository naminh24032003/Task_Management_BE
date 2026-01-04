# =============================================================================
# Istio - Base CRDs
# =============================================================================
# Installs Istio Custom Resource Definitions
# =============================================================================

resource "helm_release" "istio_base" {
  count = var.istio_enabled ? 1 : 0

  name       = "istio-base"
  namespace  = var.istio_namespace
  repository = "https://istio-release.storage.googleapis.com/charts"
  chart      = "base"
  version    = var.istio_base_chart_version

  # Installation options
  wait          = true
  timeout       = 300
  force_update  = false
  recreate_pods = false

  depends_on = [kubernetes_namespace.istio_system]
}
