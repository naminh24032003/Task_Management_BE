# =============================================================================
# Kafka Platform Module - Main Configuration
# =============================================================================
# This module deploys Apache Kafka using Bitnami Helm chart with:
# - SASL/SCRAM authentication
# - KRaft mode (no Zookeeper)
# - Kafka UI for monitoring
# - Optimized for Minikube and EKS
# =============================================================================

# -----------------------------------------------------------------------------
# Namespace
# -----------------------------------------------------------------------------
resource "kubernetes_namespace" "kafka" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name = var.namespace
    labels = {
      name        = var.namespace
      environment = var.environment
      managed-by  = "terraform"
    }
  }
}

locals {
  namespace = var.create_namespace ? kubernetes_namespace.kafka[0].metadata[0].name : var.namespace
}

# -----------------------------------------------------------------------------
# Kafka SASL Credentials Secret
# -----------------------------------------------------------------------------
resource "kubernetes_secret" "kafka_sasl" {
  metadata {
    name      = "kafka-sasl-credentials"
    namespace = local.namespace
  }

  data = {
    "client-passwords" = var.sasl_password
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# Kafka Helm Release
# -----------------------------------------------------------------------------
resource "helm_release" "kafka" {
  name       = var.release_name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "kafka"
  version    = var.chart_version
  namespace  = local.namespace

  values = [
    templatefile("${path.module}/values.yaml", {
      # Authentication
      sasl_user     = var.sasl_user
      sasl_password = var.sasl_password

      # Controller (KRaft mode)
      controller_replica_count        = var.controller_replica_count
      controller_request_cpu          = var.controller_resources.requests.cpu
      controller_request_memory       = var.controller_resources.requests.memory
      controller_limit_cpu            = var.controller_resources.limits.cpu
      controller_limit_memory         = var.controller_resources.limits.memory
      controller_persistence_enabled  = var.persistence_enabled
      controller_persistence_size     = var.controller_persistence_size
      controller_log_persistence_size = var.controller_log_persistence_size
      storage_class                   = var.storage_class

      # Broker
      broker_replica_count  = var.broker_replica_count
      broker_request_cpu    = var.broker_resources.requests.cpu
      broker_request_memory = var.broker_resources.requests.memory
      broker_limit_cpu      = var.broker_resources.limits.cpu
      broker_limit_memory   = var.broker_resources.limits.memory

      # Volume permissions
      volume_permissions_enabled        = var.volume_permissions_enabled
      volume_permissions_request_cpu    = var.volume_permissions_resources.requests.cpu
      volume_permissions_request_memory = var.volume_permissions_resources.requests.memory
      volume_permissions_limit_cpu      = var.volume_permissions_resources.limits.cpu
      volume_permissions_limit_memory   = var.volume_permissions_resources.limits.memory

      # Node selector
      is_minikube = var.is_minikube
    })
  ]

  timeout = 600

  depends_on = [
    kubernetes_secret.kafka_sasl
  ]
}

# -----------------------------------------------------------------------------
# Kafka Service Data Source
# -----------------------------------------------------------------------------
data "kubernetes_service" "kafka" {
  metadata {
    name      = "${var.release_name}"
    namespace = local.namespace
  }

  depends_on = [helm_release.kafka]
}

# -----------------------------------------------------------------------------
# Kafka UI Deployment
# -----------------------------------------------------------------------------
resource "kubernetes_deployment" "kafka_ui" {
  count = var.kafka_ui_enabled ? 1 : 0

  metadata {
    name      = "kafka-ui"
    namespace = local.namespace

    labels = {
      app         = "kafka-ui"
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "kafka-ui"
      }
    }

    template {
      metadata {
        labels = {
          app = "kafka-ui"
        }
      }

      spec {
        node_selector = var.is_minikube ? {} : {
          "node-role" = "platform"
        }

        container {
          name  = "kafka-ui"
          image = var.kafka_ui_image

          port {
            container_port = 8080
            name           = "http"
          }

          # Kafka cluster connection
          env {
            name  = "KAFKA_CLUSTERS_0_NAME"
            value = "kafka"
          }

          env {
            name  = "KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS"
            value = "${var.release_name}.${local.namespace}.svc.cluster.local:9092"
          }

          env {
            name  = "KAFKA_CLUSTERS_0_PROPERTIES_SECURITY_PROTOCOL"
            value = "SASL_PLAINTEXT"
          }

          env {
            name  = "KAFKA_CLUSTERS_0_PROPERTIES_SASL_MECHANISM"
            value = "SCRAM-SHA-256"
          }

          env {
            name  = "KAFKA_CLUSTERS_0_PROPERTIES_SASL_JAAS_CONFIG"
            value = "org.apache.kafka.common.security.scram.ScramLoginModule required username=\"${var.sasl_user}\" password=\"${var.sasl_password}\";"
          }

          resources {
            requests = {
              cpu    = var.kafka_ui_resources.requests.cpu
              memory = var.kafka_ui_resources.requests.memory
            }
            limits = {
              cpu    = var.kafka_ui_resources.limits.cpu
              memory = var.kafka_ui_resources.limits.memory
            }
          }

          liveness_probe {
            http_get {
              path = "/actuator/health"
              port = 8080
            }
            initial_delay_seconds = 90
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/actuator/health"
              port = 8080
            }
            initial_delay_seconds = 60
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }
      }
    }
  }

  depends_on = [helm_release.kafka]
}

# -----------------------------------------------------------------------------
# Kafka UI Service
# -----------------------------------------------------------------------------
resource "kubernetes_service" "kafka_ui" {
  count = var.kafka_ui_enabled ? 1 : 0

  metadata {
    name      = "kafka-ui"
    namespace = local.namespace
    labels = {
      app = "kafka-ui"
    }
  }

  spec {
    type = var.service_type

    selector = {
      app = "kafka-ui"
    }

    port {
      name        = "http"
      port        = 8080
      target_port = 8080
    }
  }

  depends_on = [kubernetes_deployment.kafka_ui]
}
