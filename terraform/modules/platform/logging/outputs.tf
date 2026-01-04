# =============================================================================
# Logging Module - Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Loki Service Information
# -----------------------------------------------------------------------------

output "loki_service_name" {
  description = "Name of the Loki service"
  value       = var.loki_enabled ? local.loki_service : null
}

output "loki_service_url" {
  description = "Internal URL for Loki service"
  value       = var.loki_enabled ? "http://${local.loki_service}.${var.namespace}.svc.cluster.local:3100" : null
}

output "loki_service_port" {
  description = "Port of the Loki service"
  value       = var.loki_enabled ? 3100 : null
}

# -----------------------------------------------------------------------------
# Namespace Information
# -----------------------------------------------------------------------------

output "namespace" {
  description = "Namespace where logging components are deployed"
  value       = var.namespace
}

# -----------------------------------------------------------------------------
# Helm Release Information
# -----------------------------------------------------------------------------

output "helm_release_name" {
  description = "Name of the Loki-stack Helm release"
  value       = var.loki_enabled ? helm_release.loki_stack[0].name : null
}

output "helm_release_version" {
  description = "Version of the Loki-stack Helm chart"
  value       = var.loki_enabled ? helm_release.loki_stack[0].version : null
}

output "helm_release_status" {
  description = "Status of the Loki-stack Helm release"
  value       = var.loki_enabled ? helm_release.loki_stack[0].status : null
}

# -----------------------------------------------------------------------------
# Datasource ConfigMap
# -----------------------------------------------------------------------------

output "grafana_datasource_configmap" {
  description = "Name of the Grafana datasource ConfigMap for Loki"
  value       = var.grafana_datasource_enabled && var.loki_enabled ? kubernetes_config_map.loki_datasource[0].metadata[0].name : null
}

# -----------------------------------------------------------------------------
# Connection Information (for other modules)
# -----------------------------------------------------------------------------

output "promtail_config" {
  description = "Promtail configuration for applications"
  value = {
    enabled    = var.promtail_enabled
    loki_url   = var.loki_enabled ? "http://${local.loki_service}.${var.namespace}.svc.cluster.local:3100" : null
    loki_port  = 3100
  }
}
