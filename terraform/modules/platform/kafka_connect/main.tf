# =============================================================================
# Kafka Connect with Debezium - Main Configuration
# =============================================================================
# This module deploys Kafka Connect with Debezium MongoDB connector for CDC
# Implements the Outbox Pattern with Change Data Capture
# =============================================================================

# -----------------------------------------------------------------------------
# Namespace
# -----------------------------------------------------------------------------
resource "kubernetes_namespace" "kafka_connect" {
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
  namespace = var.create_namespace ? kubernetes_namespace.kafka_connect[0].metadata[0].name : var.namespace
}

# -----------------------------------------------------------------------------
# Kafka Connect ConfigMap
# -----------------------------------------------------------------------------
resource "kubernetes_config_map" "kafka_connect_config" {
  metadata {
    name      = "kafka-connect-config"
    namespace = local.namespace
  }

  data = {
    "connect-distributed.properties" = templatefile("${path.module}/config/connect-distributed.properties.tpl", {
      kafka_bootstrap_servers = var.kafka_bootstrap_servers
      kafka_sasl_username     = var.kafka_sasl_username
      kafka_sasl_password     = var.kafka_sasl_password
      group_id                = var.connect_group_id
      config_storage_topic    = var.config_storage_topic
      offset_storage_topic    = var.offset_storage_topic
      status_storage_topic    = var.status_storage_topic
    })
  }
}

# -----------------------------------------------------------------------------
# Kafka Connect Deployment
# -----------------------------------------------------------------------------
resource "kubernetes_deployment" "kafka_connect" {
  metadata {
    name      = "kafka-connect"
    namespace = local.namespace

    labels = {
      app         = "kafka-connect"
      environment = var.environment
    }
  }

  spec {
    replicas = var.replicas

    selector {
      match_labels = {
        app = "kafka-connect"
      }
    }

    template {
      metadata {
        labels = {
          app = "kafka-connect"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "8083"
          "prometheus.io/path"   = "/metrics"
        }
      }

      spec {
        node_selector = var.is_minikube ? {} : {
          "node-role" = "platform"
        }

        container {
          name  = "kafka-connect"
          image = var.debezium_image

          port {
            container_port = 8083
            name           = "rest"
          }

          env {
            name  = "BOOTSTRAP_SERVERS"
            value = var.kafka_bootstrap_servers
          }

          env {
            name  = "GROUP_ID"
            value = var.connect_group_id
          }

          env {
            name  = "CONFIG_STORAGE_TOPIC"
            value = var.config_storage_topic
          }

          env {
            name  = "OFFSET_STORAGE_TOPIC"
            value = var.offset_storage_topic
          }

          env {
            name  = "STATUS_STORAGE_TOPIC"
            value = var.status_storage_topic
          }

          # SASL Configuration
          env {
            name  = "CONNECT_SECURITY_PROTOCOL"
            value = "SASL_PLAINTEXT"
          }

          env {
            name  = "CONNECT_SASL_MECHANISM"
            value = "SCRAM-SHA-256"
          }

          env {
            name = "CONNECT_SASL_JAAS_CONFIG"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.kafka_connect_credentials.metadata[0].name
                key  = "sasl-jaas-config"
              }
            }
          }

          # Producer SASL
          env {
            name  = "CONNECT_PRODUCER_SECURITY_PROTOCOL"
            value = "SASL_PLAINTEXT"
          }

          env {
            name  = "CONNECT_PRODUCER_SASL_MECHANISM"
            value = "SCRAM-SHA-256"
          }

          env {
            name = "CONNECT_PRODUCER_SASL_JAAS_CONFIG"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.kafka_connect_credentials.metadata[0].name
                key  = "sasl-jaas-config"
              }
            }
          }

          # Consumer SASL
          env {
            name  = "CONNECT_CONSUMER_SECURITY_PROTOCOL"
            value = "SASL_PLAINTEXT"
          }

          env {
            name  = "CONNECT_CONSUMER_SASL_MECHANISM"
            value = "SCRAM-SHA-256"
          }

          env {
            name = "CONNECT_CONSUMER_SASL_JAAS_CONFIG"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.kafka_connect_credentials.metadata[0].name
                key  = "sasl-jaas-config"
              }
            }
          }

          # Key/Value Converters
          env {
            name  = "KEY_CONVERTER"
            value = "org.apache.kafka.connect.json.JsonConverter"
          }

          env {
            name  = "VALUE_CONVERTER"
            value = "org.apache.kafka.connect.json.JsonConverter"
          }

          env {
            name  = "KEY_CONVERTER_SCHEMAS_ENABLE"
            value = "false"
          }

          env {
            name  = "VALUE_CONVERTER_SCHEMAS_ENABLE"
            value = "false"
          }

          resources {
            requests = {
              cpu    = var.resources.requests.cpu
              memory = var.resources.requests.memory
            }
            limits = {
              cpu    = var.resources.limits.cpu
              memory = var.resources.limits.memory
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 8083
            }
            initial_delay_seconds = 60
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/connectors"
              port = 8083
            }
            initial_delay_seconds = 30
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Kafka Connect Service
# -----------------------------------------------------------------------------
resource "kubernetes_service" "kafka_connect" {
  metadata {
    name      = "kafka-connect"
    namespace = local.namespace
    labels = {
      app = "kafka-connect"
    }
  }

  spec {
    type = "ClusterIP"

    selector = {
      app = "kafka-connect"
    }

    port {
      name        = "rest"
      port        = 8083
      target_port = 8083
    }
  }
}

# -----------------------------------------------------------------------------
# Credentials Secret
# -----------------------------------------------------------------------------
resource "kubernetes_secret" "kafka_connect_credentials" {
  metadata {
    name      = "kafka-connect-credentials"
    namespace = local.namespace
  }

  data = {
    "sasl-jaas-config" = "org.apache.kafka.common.security.scram.ScramLoginModule required username=\"${var.kafka_sasl_username}\" password=\"${var.kafka_sasl_password}\";"
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# MongoDB Credentials Secret (for Debezium connector)
# -----------------------------------------------------------------------------
resource "kubernetes_secret" "mongodb_credentials" {
  metadata {
    name      = "debezium-mongodb-credentials"
    namespace = local.namespace
  }

  data = {
    "mongodb-uri"      = var.mongodb_connection_string
    "mongodb-user"     = var.mongodb_user
    "mongodb-password" = var.mongodb_password
  }

  type = "Opaque"
}
