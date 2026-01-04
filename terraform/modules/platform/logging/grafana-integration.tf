# =============================================================================
# Logging - Grafana Integration
# =============================================================================
# Creates Grafana datasource ConfigMap for Loki integration
# =============================================================================

resource "kubernetes_config_map" "loki_datasource" {
  count = var.grafana_datasource_enabled && var.loki_enabled ? 1 : 0

  metadata {
    name      = "loki-datasource"
    namespace = var.grafana_namespace
    labels = merge(local.common_labels, {
      "grafana_datasource" = "1"
    })
  }

  data = {
    "loki-datasource.yaml" = yamlencode({
      apiVersion = 1
      datasources = [{
        name      = "Loki"
        type      = "loki"
        access    = "proxy"
        url       = "http://${local.loki_service}.${var.namespace}.svc.cluster.local:3100"
        version   = 1
        editable  = false
        isDefault = false
        jsonData = {
          maxLines = 1000
        }
      }]
    })
  }

  depends_on = [helm_release.loki_stack]
}
