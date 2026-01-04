# =============================================================================
# Istio - Istiod (Control Plane)
# =============================================================================
# Deploys the Istio control plane (Pilot, Galley, Citadel)
# =============================================================================

resource "helm_release" "istiod" {
  count = var.istio_enabled ? 1 : 0

  name       = "istiod"
  namespace  = var.istio_namespace
  repository = "https://istio-release.storage.googleapis.com/charts"
  chart      = "istiod"
  version    = var.istiod_chart_version

  # Installation options
  wait          = true
  timeout       = 600
  force_update  = false
  recreate_pods = false

  # Values from template
  values = [
    templatefile("${path.module}/values/istiod.yaml", {
      # Istiod Resources
      istiod_request_cpu    = var.istiod_resources.requests.cpu
      istiod_request_memory = var.istiod_resources.requests.memory
      istiod_limit_cpu      = var.istiod_resources.limits.cpu
      istiod_limit_memory   = var.istiod_resources.limits.memory
      
      # Sidecar Proxy Defaults
      proxy_request_cpu    = var.proxy_resources.requests.cpu
      proxy_request_memory = var.proxy_resources.requests.memory
      proxy_limit_cpu      = var.proxy_resources.limits.cpu
      proxy_limit_memory   = var.proxy_resources.limits.memory
      
      # Tracing Configuration
      tracing_enabled       = var.tracing_enabled
      tracing_sampling_rate = var.tracing_sampling_rate
    })
  ]

  depends_on = [helm_release.istio_base]
}
