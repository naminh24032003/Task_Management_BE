# =============================================================================
# Minikube Environment - Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

output "monitoring" {
  description = "Monitoring stack information"
  value = var.monitoring_enabled ? {
    prometheus_url   = module.monitoring[0].prometheus_url
    grafana_url      = module.monitoring[0].grafana_url
    alertmanager_url = module.monitoring[0].alertmanager_url
    namespace        = module.monitoring[0].namespace
  } : null
}

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------

output "logging" {
  description = "Logging stack information"
  value = var.logging_enabled ? {
    loki_url  = module.logging[0].loki_service_url
    namespace = module.logging[0].namespace
  } : null
}

# -----------------------------------------------------------------------------
# Istio
# -----------------------------------------------------------------------------

output "istio" {
  description = "Istio service mesh information"
  value = var.istio_enabled ? {
    namespace   = module.istio[0].istio_namespace
    mtls_status = module.istio[0].mtls_status
    mesh_config = module.istio[0].mesh_config
  } : null
}

# -----------------------------------------------------------------------------
# Access Commands
# -----------------------------------------------------------------------------

output "access_commands" {
  description = "Commands to access services"
  value = <<-EOT
    # Port-forward Grafana:
    kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
    # Open: http://localhost:3000 (admin/prom-operator)
    
    # Port-forward Prometheus:
    kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
    # Open: http://localhost:9090
    
    # Port-forward Alertmanager:
    kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-alertmanager 9093:9093
    # Open: http://localhost:9093
  EOT
}
