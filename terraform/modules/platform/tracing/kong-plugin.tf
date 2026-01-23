# =============================================================================
# Tracing Module - Kong OpenTelemetry Plugin
# =============================================================================
# Creates KongClusterPlugin for distributed tracing integration
# =============================================================================

resource "kubernetes_manifest" "kong_otel_plugin" {
  count = var.kong_plugin_enabled ? 1 : 0

  manifest = {
    apiVersion = "configuration.konghq.com/v1"
    kind       = "KongClusterPlugin"

    metadata = {
      name = "global-opentelemetry-tracing"
      annotations = {
        "kubernetes.io/ingress.class" = "kong"
      }
      labels = merge(local.common_labels, {
        "global" = var.kong_plugin_global ? "true" : "false"
      })
    }

    config = {
      endpoint = "http://${local.otel_http_endpoint}/v1/traces"
      resource_attributes = {
        "service.name"            = "kong-gateway"
        "deployment.environment"  = var.environment
        "service.namespace"       = "task-management"
      }
      headers         = {}
      header_type     = "w3c"
      batch_span_count = var.batch_span_count
      batch_flush_delay = var.batch_flush_delay
    }

    plugin = "opentelemetry"
  }

  depends_on = [kubernetes_service.otel_collector]
}
