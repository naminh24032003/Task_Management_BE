# =============================================================================
# Istio Module - Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Istio System Information
# -----------------------------------------------------------------------------

output "istio_namespace" {
  description = "Namespace where Istio is installed"
  value       = var.istio_enabled ? var.istio_namespace : null
}

output "istiod_version" {
  description = "Version of Istiod installed"
  value       = var.istio_enabled ? helm_release.istiod[0].version : null
}

# -----------------------------------------------------------------------------
# Helm Release Information
# -----------------------------------------------------------------------------

output "istio_base_release" {
  description = "Istio base Helm release info"
  value = var.istio_enabled ? {
    name    = helm_release.istio_base[0].name
    version = helm_release.istio_base[0].version
    status  = helm_release.istio_base[0].status
  } : null
}

output "istiod_release" {
  description = "Istiod Helm release info"
  value = var.istio_enabled ? {
    name    = helm_release.istiod[0].name
    version = helm_release.istiod[0].version
    status  = helm_release.istiod[0].status
  } : null
}

# -----------------------------------------------------------------------------
# Configuration Status
# -----------------------------------------------------------------------------

output "mtls_status" {
  description = "mTLS configuration status"
  value = {
    enabled = var.mtls_enabled
    mode    = var.mtls_mode
  }
}

output "traffic_management_status" {
  description = "Traffic management configuration"
  value = {
    enabled        = var.traffic_management_enabled
    canary_enabled = var.canary_enabled
    services       = var.istio_enabled && var.traffic_management_enabled ? keys(var.services) : []
  }
}

output "observability_status" {
  description = "Observability configuration"
  value = {
    tracing_enabled     = var.tracing_enabled
    metrics_enabled     = var.metrics_enabled
    dashboards_enabled  = var.grafana_dashboards_enabled
    sampling_rate       = var.tracing_sampling_rate
  }
}

# -----------------------------------------------------------------------------
# Integration Information
# -----------------------------------------------------------------------------

output "mesh_config" {
  description = "Service mesh configuration for other modules"
  value = {
    namespace            = var.namespace
    injection_label      = "istio-injection=enabled"
    monitoring_namespace = var.monitoring_namespace
    kong_excluded        = var.kong_exclude_from_mesh
  }
}
