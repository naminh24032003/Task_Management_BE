# =============================================================================
# Monitoring Module Outputs
# =============================================================================

# =============================================================================
# Prometheus Outputs
# =============================================================================

output "prometheus_service_name" {
  description = "Prometheus service name"
  value       = var.prometheus_enabled ? local.prometheus_service : null
}

output "prometheus_url" {
  description = "Prometheus internal URL"
  value       = var.prometheus_enabled ? "http://${local.prometheus_service}.${var.namespace}.svc.cluster.local:9090" : null
}

output "prometheus_port" {
  description = "Prometheus service port"
  value       = 9090
}

# =============================================================================
# Alertmanager Outputs
# =============================================================================

output "alertmanager_service_name" {
  description = "Alertmanager service name"
  value       = var.alertmanager_enabled ? local.alertmanager_service : null
}

output "alertmanager_url" {
  description = "Alertmanager internal URL"
  value       = var.alertmanager_enabled ? "http://${local.alertmanager_service}.${var.namespace}.svc.cluster.local:9093" : null
}

output "alertmanager_port" {
  description = "Alertmanager service port"
  value       = 9093
}

# =============================================================================
# Grafana Outputs
# =============================================================================

output "grafana_service_name" {
  description = "Grafana service name"
  value       = var.grafana_enabled ? local.grafana_service : null
}

output "grafana_url" {
  description = "Grafana internal URL"
  value       = var.grafana_enabled ? "http://${local.grafana_service}.${var.namespace}.svc.cluster.local:80" : null
}

output "grafana_port" {
  description = "Grafana service port"
  value       = 80
}

output "grafana_admin_user" {
  description = "Grafana admin username"
  value       = var.grafana_admin_user
  sensitive   = true
}

# =============================================================================
# General Outputs
# =============================================================================

output "namespace" {
  description = "Monitoring namespace"
  value       = var.namespace
}

output "release_name" {
  description = "Helm release name"
  value       = local.release_name
}
