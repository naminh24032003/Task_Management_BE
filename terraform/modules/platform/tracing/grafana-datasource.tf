# =============================================================================
# Tracing Module - Grafana Datasource
# =============================================================================
# Creates Tempo as Grafana data source via ConfigMap
# =============================================================================

resource "kubernetes_config_map" "grafana_tempo_datasource" {
  count = var.grafana_datasource_enabled ? 1 : 0

  metadata {
    name      = "grafana-datasource-tempo"
    namespace = var.grafana_namespace

    labels = merge(local.common_labels, {
      "grafana_datasource" = "1"
    })
  }

  data = {
    "tempo-datasource.yaml" = yamlencode({
      apiVersion = 1
      datasources = [
        {
          name      = "Tempo"
          type      = "tempo"
          access    = "proxy"
          url       = "http://${local.tempo_endpoint}:3100"
          isDefault = false
          editable  = true
          jsonData = {
            httpMethod    = "GET"
            tracesToLogs = {
              datasourceUid = "loki"
              tags          = ["job", "pod", "namespace"]
              mappedTags    = [{ key = "service.name", value = "service" }]
              spanStartTimeShift = "1h"
              spanEndTimeShift   = "1h"
              filterByTraceID    = true
              filterBySpanID     = true
            }
            tracesToMetrics = {
              datasourceUid = "prometheus"
              tags          = [{ key = "service.name", value = "service" }]
              queries = [
                {
                  name  = "Request rate"
                  query = "sum(rate(traces_spanmetrics_calls_total{$$__tags}[5m]))"
                }
              ]
            }
            serviceMap = {
              datasourceUid = "prometheus"
            }
            nodeGraph = {
              enabled = true
            }
            lokiSearch = {
              datasourceUid = "loki"
            }
          }
        }
      ]
    })
  }
}
