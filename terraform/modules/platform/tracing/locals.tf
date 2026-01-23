# =============================================================================
# Tracing Module - Local Variables
# =============================================================================

locals {
  # Release names
  tempo_release_name = "tempo"
  otel_release_name  = "otel-collector"

  # Labels
  common_labels = {
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  }

  # OTEL Collector endpoint (internal service URL)
  otel_collector_endpoint = "${local.otel_release_name}.${var.namespace}.svc.cluster.local"
  otel_grpc_endpoint      = "${local.otel_collector_endpoint}:${var.otlp_grpc_port}"
  otel_http_endpoint      = "${local.otel_collector_endpoint}:${var.otlp_http_port}"

  # Tempo endpoint (internal service URL)
  tempo_endpoint = "${local.tempo_release_name}.${var.namespace}.svc.cluster.local"
}
