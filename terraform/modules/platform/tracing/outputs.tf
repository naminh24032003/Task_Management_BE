# =============================================================================
# Tracing Module - Outputs
# =============================================================================

output "namespace" {
  description = "Tracing namespace"
  value       = var.namespace
}

output "tempo_endpoint" {
  description = "Tempo internal endpoint"
  value       = var.tempo_enabled ? local.tempo_endpoint : null
}

output "tempo_query_url" {
  description = "Tempo query URL for Grafana"
  value       = var.tempo_enabled ? "http://${local.tempo_endpoint}:3200" : null
}

output "otel_collector_grpc_endpoint" {
  description = "OTEL Collector gRPC endpoint for services"
  value       = var.otel_collector_enabled ? "http://${local.otel_grpc_endpoint}" : null
}

output "otel_collector_http_endpoint" {
  description = "OTEL Collector HTTP endpoint for services"
  value       = var.otel_collector_enabled ? "http://${local.otel_http_endpoint}" : null
}

output "service_environment_variables" {
  description = "Environment variables to add to services for tracing"
  value = var.otel_collector_enabled ? {
    OTEL_EXPORTER_OTLP_ENDPOINT = "http://${local.otel_grpc_endpoint}"
    OTEL_TRACES_SAMPLER         = var.sampling_rate == 1.0 ? "always_on" : "parentbased_traceidratio"
    OTEL_TRACES_SAMPLER_ARG     = tostring(var.sampling_rate)
  } : {}
}

output "kong_plugin_name" {
  description = "Kong OpenTelemetry plugin name"
  value       = var.kong_plugin_enabled ? "global-opentelemetry-tracing" : null
}
