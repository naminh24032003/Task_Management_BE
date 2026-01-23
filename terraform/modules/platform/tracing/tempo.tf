# =============================================================================
# Tracing Module - Grafana Tempo
# =============================================================================
# Deploys Grafana Tempo for distributed trace storage and querying
# =============================================================================

resource "helm_release" "tempo" {
  count = var.tempo_enabled ? 1 : 0

  name       = local.tempo_release_name
  namespace  = var.namespace
  repository = "https://grafana.github.io/helm-charts"
  chart      = "tempo"
  version    = var.tempo_chart_version

  # Installation options
  wait         = true
  timeout      = 600
  atomic       = false
  force_update = false

  # Values from template
  values = [
    templatefile("${path.module}/values/tempo.yaml", {
      # Storage
      storage_enabled = var.tempo_storage_enabled
      storage_size    = var.tempo_storage_size
      storage_class   = var.tempo_storage_class
      retention       = var.tempo_retention

      # Resources
      request_cpu    = var.tempo_resources.requests.cpu
      request_memory = var.tempo_resources.requests.memory
      limit_cpu      = var.tempo_resources.limits.cpu
      limit_memory   = var.tempo_resources.limits.memory

      # Receivers
      otlp_grpc_port = var.otlp_grpc_port
      otlp_http_port = var.otlp_http_port
    })
  ]

  depends_on = [kubernetes_namespace.tracing]
}
