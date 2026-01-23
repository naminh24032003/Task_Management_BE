# =============================================================================
# Tracing Module - OpenTelemetry Collector
# =============================================================================
# Deploys OTEL Collector as central hub for trace collection
# =============================================================================

# -----------------------------------------------------------------------------
# OTEL Collector ConfigMap
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "otel_collector" {
  count = var.otel_collector_enabled ? 1 : 0

  metadata {
    name      = "${local.otel_release_name}-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    "config.yaml" = templatefile("${path.module}/config/otel-collector.yaml", {
      otlp_grpc_port    = var.otlp_grpc_port
      otlp_http_port    = var.otlp_http_port
      tempo_endpoint    = "${local.tempo_endpoint}:${var.otlp_grpc_port}"
      batch_span_count  = var.batch_span_count
      batch_flush_delay = var.batch_flush_delay
    })
  }

  depends_on = [kubernetes_namespace.tracing]
}

# -----------------------------------------------------------------------------
# OTEL Collector Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "otel_collector" {
  count = var.otel_collector_enabled ? 1 : 0

  metadata {
    name      = local.otel_release_name
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app" = local.otel_release_name
    })
  }

  spec {
    replicas = var.otel_collector_replicas

    selector {
      match_labels = {
        "app" = local.otel_release_name
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app" = local.otel_release_name
        })
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "8888"
          "prometheus.io/path"   = "/metrics"
        }
      }

      spec {
        container {
          name  = "otel-collector"
          image = "${var.otel_collector_image}:${var.otel_collector_image_tag}"

          args = ["--config=/conf/config.yaml"]

          port {
            name           = "otlp-grpc"
            container_port = var.otlp_grpc_port
            protocol       = "TCP"
          }

          port {
            name           = "otlp-http"
            container_port = var.otlp_http_port
            protocol       = "TCP"
          }

          port {
            name           = "metrics"
            container_port = 8888
            protocol       = "TCP"
          }

          resources {
            requests = {
              cpu    = var.otel_collector_resources.requests.cpu
              memory = var.otel_collector_resources.requests.memory
            }
            limits = {
              cpu    = var.otel_collector_resources.limits.cpu
              memory = var.otel_collector_resources.limits.memory
            }
          }

          volume_mount {
            name       = "config"
            mount_path = "/conf"
            read_only  = true
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 13133
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 13133
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.otel_collector[0].metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_namespace.tracing,
    kubernetes_config_map.otel_collector
  ]
}

# -----------------------------------------------------------------------------
# OTEL Collector Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "otel_collector" {
  count = var.otel_collector_enabled ? 1 : 0

  metadata {
    name      = local.otel_release_name
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    type = var.service_type

    port {
      name        = "otlp-grpc"
      port        = var.otlp_grpc_port
      target_port = var.otlp_grpc_port
      protocol    = "TCP"
    }

    port {
      name        = "otlp-http"
      port        = var.otlp_http_port
      target_port = var.otlp_http_port
      protocol    = "TCP"
    }

    port {
      name        = "metrics"
      port        = 8888
      target_port = 8888
      protocol    = "TCP"
    }

    selector = {
      "app" = local.otel_release_name
    }
  }

  depends_on = [kubernetes_deployment.otel_collector]
}
