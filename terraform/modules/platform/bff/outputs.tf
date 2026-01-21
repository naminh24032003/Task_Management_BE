# =============================================================================
# BFF Module - Outputs
# =============================================================================

output "enabled" {
  description = "Whether BFF service is enabled"
  value       = var.bff_enabled
}

output "service_name" {
  description = "BFF service name"
  value       = var.bff_enabled ? helm_release.bff_service[0].name : null
}

output "service_namespace" {
  description = "BFF service namespace"
  value       = var.namespace
}

output "graphql_endpoint" {
  description = "GraphQL endpoint URL (internal)"
  value       = var.bff_enabled ? "http://${var.release_name}-microservice.${var.namespace}.svc.cluster.local:4000/graphql" : null
}

output "metrics_endpoint" {
  description = "Metrics endpoint URL (internal)"
  value       = var.bff_enabled ? "http://${var.release_name}-microservice.${var.namespace}.svc.cluster.local:9092/metrics" : null
}

output "health_endpoint" {
  description = "Health endpoint URL (internal)"
  value       = var.bff_enabled ? "http://${var.release_name}-microservice.${var.namespace}.svc.cluster.local:9092/health" : null
}

output "ingress_host" {
  description = "Ingress hostname"
  value       = var.ingress_enabled ? var.ingress_host : null
}

output "helm_release_status" {
  description = "Helm release status"
  value       = var.bff_enabled ? helm_release.bff_service[0].status : null
}

output "helm_release_version" {
  description = "Helm release version"
  value       = var.bff_enabled ? helm_release.bff_service[0].version : null
}
