# =============================================================================
# Monitoring - Prometheus Stack (Prometheus + Alertmanager + Grafana)
# =============================================================================
# Deploys kube-prometheus-stack which includes:
# - Prometheus Operator
# - Prometheus
# - Alertmanager
# - Grafana
# - Node Exporter
# - Kube State Metrics
# =============================================================================

resource "helm_release" "kube_prometheus_stack" {
  count = var.prometheus_enabled ? 1 : 0

  name       = local.release_name
  namespace  = var.namespace
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = var.prometheus_chart_version

  # Installation options
  wait          = true
  timeout       = 900
  atomic        = false
  force_update  = false
  recreate_pods = false

  # Render values from template
  values = [
    templatefile("${path.module}/values/prometheus-stack.yaml", {
      # Prometheus
      prometheus_enabled        = var.prometheus_enabled
      prometheus_storage_enabled = var.prometheus_storage_enabled
      prometheus_storage_size   = var.prometheus_storage_size
      prometheus_storage_class  = var.prometheus_storage_class
      prometheus_retention      = var.prometheus_retention
      prometheus_request_cpu    = var.prometheus_resources.requests.cpu
      prometheus_request_memory = var.prometheus_resources.requests.memory
      prometheus_limit_cpu      = var.prometheus_resources.limits.cpu
      prometheus_limit_memory   = var.prometheus_resources.limits.memory
      
      # Alertmanager
      alertmanager_enabled        = var.alertmanager_enabled
      alertmanager_storage_enabled = var.alertmanager_storage_enabled
      alertmanager_storage_size   = var.alertmanager_storage_size
      alertmanager_storage_class  = var.alertmanager_storage_class
      alertmanager_request_cpu    = var.alertmanager_resources.requests.cpu
      alertmanager_request_memory = var.alertmanager_resources.requests.memory
      alertmanager_limit_cpu      = var.alertmanager_resources.limits.cpu
      alertmanager_limit_memory   = var.alertmanager_resources.limits.memory
      
      # Grafana
      grafana_enabled        = var.grafana_enabled
      grafana_admin_user     = var.grafana_admin_user
      grafana_admin_password = var.grafana_admin_password
      grafana_storage_enabled = var.grafana_storage_enabled
      grafana_storage_size   = var.grafana_storage_size
      grafana_storage_class  = var.grafana_storage_class
      grafana_request_cpu    = var.grafana_resources.requests.cpu
      grafana_request_memory = var.grafana_resources.requests.memory
      grafana_limit_cpu      = var.grafana_resources.limits.cpu
      grafana_limit_memory   = var.grafana_resources.limits.memory
      
      # Additional
      loki_url                   = var.loki_url
      jaeger_url                 = var.jaeger_url
      node_exporter_enabled      = var.node_exporter_enabled
      kube_state_metrics_enabled = var.kube_state_metrics_enabled
      
      # Service
      service_type = var.service_type
    })
  ]

  depends_on = [kubernetes_namespace.monitoring]
}
