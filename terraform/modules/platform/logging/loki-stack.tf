# =============================================================================
# Logging - Loki Stack (Loki + Promtail)
# =============================================================================
# Deploys Loki for log aggregation and Promtail for log collection
# =============================================================================

resource "helm_release" "loki_stack" {
  count = var.loki_enabled ? 1 : 0

  name       = local.release_name
  namespace  = var.namespace
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki-stack"
  version    = var.loki_chart_version

  # Installation options
  wait          = true
  timeout       = 600
  atomic        = false
  force_update  = false
  recreate_pods = false

  # Render values from template
  values = [
    templatefile("${path.module}/values/loki-stack.yaml", {
      # Loki
      loki_enabled          = var.loki_enabled
      loki_storage_enabled  = var.loki_storage_enabled
      loki_storage_size     = var.loki_storage_size
      loki_storage_class    = var.loki_storage_class
      loki_retention_period = var.loki_retention_period
      loki_request_cpu      = var.loki_resources.requests.cpu
      loki_request_memory   = var.loki_resources.requests.memory
      loki_limit_cpu        = var.loki_resources.limits.cpu
      loki_limit_memory     = var.loki_resources.limits.memory
      
      # Promtail
      promtail_enabled        = var.promtail_enabled
      promtail_request_cpu    = var.promtail_resources.requests.cpu
      promtail_request_memory = var.promtail_resources.requests.memory
      promtail_limit_cpu      = var.promtail_resources.limits.cpu
      promtail_limit_memory   = var.promtail_resources.limits.memory
      
      # Release name for Promtail client URL
      release_name = local.release_name
    })
  ]

  depends_on = [kubernetes_namespace.logging]
}
