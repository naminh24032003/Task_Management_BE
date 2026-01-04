# =============================================================================
# Istio - Observability
# =============================================================================
# Configures PodMonitors, ServiceMonitors, and Grafana Dashboards
# =============================================================================

# -----------------------------------------------------------------------------
# PodMonitor - Envoy Sidecar Metrics
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "envoy_podmonitor" {
  count = var.istio_enabled && var.metrics_enabled ? 1 : 0

  yaml_body = <<-YAML
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: envoy-stats
  namespace: ${var.monitoring_namespace}
  labels:
    release: ${var.prometheus_release}
spec:
  namespaceSelector:
    matchNames:
      - ${var.namespace}
  selector:
    matchExpressions:
      - key: security.istio.io/tlsMode
        operator: Exists
  podMetricsEndpoints:
    - port: http-envoy-prom
      path: /stats/prometheus
      interval: 15s
      relabelings:
        - action: keep
          sourceLabels: [__meta_kubernetes_pod_container_name]
          regex: "istio-proxy"
        - action: replace
          sourceLabels: [__meta_kubernetes_namespace]
          targetLabel: namespace
        - action: replace
          sourceLabels: [__meta_kubernetes_pod_name]
          targetLabel: pod
        - action: replace
          sourceLabels: [__meta_kubernetes_pod_label_app]
          targetLabel: app
YAML

  depends_on = [helm_release.istiod]
}

# -----------------------------------------------------------------------------
# ServiceMonitor - Istiod Metrics
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "istiod_servicemonitor" {
  count = var.istio_enabled && var.metrics_enabled ? 1 : 0

  yaml_body = <<-YAML
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: istiod
  namespace: ${var.monitoring_namespace}
  labels:
    release: ${var.prometheus_release}
spec:
  namespaceSelector:
    matchNames:
      - ${var.istio_namespace}
  selector:
    matchLabels:
      app: istiod
  endpoints:
    - port: http-monitoring
      interval: 15s
      path: /metrics
YAML

  depends_on = [helm_release.istiod]
}

# -----------------------------------------------------------------------------
# Grafana Dashboard - Istio Mesh
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "istio_mesh_dashboard" {
  count = var.istio_enabled && var.grafana_dashboards_enabled ? 1 : 0

  metadata {
    name      = "istio-mesh-dashboard"
    namespace = var.monitoring_namespace
    labels = merge(local.common_labels, {
      "grafana_dashboard" = "1"
    })
  }

  data = {
    "istio-mesh-dashboard.json" = file("${path.module}/dashboards/istio-mesh.json")
  }

  depends_on = [helm_release.istiod]
}

# -----------------------------------------------------------------------------
# Grafana Dashboard - Istio Service
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "istio_service_dashboard" {
  count = var.istio_enabled && var.grafana_dashboards_enabled ? 1 : 0

  metadata {
    name      = "istio-service-dashboard"
    namespace = var.monitoring_namespace
    labels = merge(local.common_labels, {
      "grafana_dashboard" = "1"
    })
  }

  data = {
    "istio-service-dashboard.json" = file("${path.module}/dashboards/istio-service.json")
  }

  depends_on = [helm_release.istiod]
}

# -----------------------------------------------------------------------------
# Grafana Datasource - Jaeger (Optional)
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "jaeger_datasource" {
  count = var.istio_enabled && var.tracing_enabled && var.grafana_dashboards_enabled ? 1 : 0

  metadata {
    name      = "jaeger-datasource"
    namespace = var.monitoring_namespace
    labels = merge(local.common_labels, {
      "grafana_datasource" = "1"
    })
  }

  data = {
    "jaeger-datasource.yaml" = yamlencode({
      apiVersion = 1
      datasources = [{
        name      = "Jaeger"
        type      = "jaeger"
        access    = "proxy"
        url       = "http://tracing.${var.istio_namespace}.svc.cluster.local:80"
        version   = 1
        editable  = false
        isDefault = false
      }]
    })
  }

  depends_on = [helm_release.istiod]
}
