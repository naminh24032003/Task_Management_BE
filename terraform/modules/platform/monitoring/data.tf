# =============================================================================
# Monitoring - Data Sources
# =============================================================================
# Kubernetes data sources for service discovery
# =============================================================================

# -----------------------------------------------------------------------------
# Prometheus Service
# -----------------------------------------------------------------------------

data "kubernetes_service" "prometheus" {
  count = var.prometheus_enabled ? 1 : 0

  metadata {
    name      = local.prometheus_service
    namespace = var.namespace
  }

  depends_on = [helm_release.kube_prometheus_stack]
}

# -----------------------------------------------------------------------------
# Alertmanager Service
# -----------------------------------------------------------------------------

data "kubernetes_service" "alertmanager" {
  count = var.prometheus_enabled && var.alertmanager_enabled ? 1 : 0

  metadata {
    name      = local.alertmanager_service
    namespace = var.namespace
  }

  depends_on = [helm_release.kube_prometheus_stack]
}

# -----------------------------------------------------------------------------
# Grafana Service
# -----------------------------------------------------------------------------

data "kubernetes_service" "grafana" {
  count = var.prometheus_enabled && var.grafana_enabled ? 1 : 0

  metadata {
    name      = local.grafana_service
    namespace = var.namespace
  }

  depends_on = [helm_release.kube_prometheus_stack]
}
