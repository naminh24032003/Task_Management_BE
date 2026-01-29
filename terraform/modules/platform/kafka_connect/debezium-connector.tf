# =============================================================================
# Debezium MongoDB Connector Configuration
# =============================================================================
# This creates a Kubernetes Job to register the Debezium connector
# Uses the Outbox Event Router SMT for proper event routing
# =============================================================================

# -----------------------------------------------------------------------------
# Connector Registration Job
# -----------------------------------------------------------------------------
resource "kubernetes_job" "register_connector" {
  metadata {
    name      = "register-debezium-connector"
    namespace = local.namespace
  }

  spec {
    template {
      metadata {
        labels = {
          app = "connector-registration"
        }
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "register-connector"
          image = "curlimages/curl:latest"

          command = ["/bin/sh", "-c"]
          args = [
            <<-EOT
            # Wait for Kafka Connect to be ready
            echo "Waiting for Kafka Connect to be ready..."
            until curl -s http://kafka-connect:8083/connectors; do
              echo "Kafka Connect not ready, waiting..."
              sleep 5
            done

            echo "Registering Debezium MongoDB connector..."

            # Register the Outbox connector
            curl -X PUT http://kafka-connect:8083/connectors/task-outbox-connector/config \
              -H "Content-Type: application/json" \
              -d '{
                "connector.class": "io.debezium.connector.mongodb.MongoDbConnector",
                "tasks.max": "1",

                "mongodb.connection.string": "${var.mongodb_connection_string}",
                "mongodb.user": "${var.mongodb_user}",
                "mongodb.password": "${var.mongodb_password}",

                "collection.include.list": "${var.mongodb_database}.outbox",
                "topic.prefix": "task-service",

                "capture.mode": "change_streams_update_full",
                "snapshot.mode": "initial",

                "key.converter": "org.apache.kafka.connect.json.JsonConverter",
                "key.converter.schemas.enable": "false",
                "value.converter": "org.apache.kafka.connect.json.JsonConverter",
                "value.converter.schemas.enable": "false",

                "transforms": "outbox",
                "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
                "transforms.outbox.table.field.event.id": "_id",
                "transforms.outbox.table.field.event.key": "aggregate_id",
                "transforms.outbox.table.field.event.type": "event_type",
                "transforms.outbox.table.field.event.payload": "payload",
                "transforms.outbox.table.field.event.timestamp": "created_at",
                "transforms.outbox.route.by.field": "aggregate_type",
                "transforms.outbox.route.topic.replacement": "events.$${routedByValue}",

                "tombstones.on.delete": "false",
                "provide.transaction.metadata": "false",

                "errors.tolerance": "all",
                "errors.log.enable": "true",
                "errors.log.include.messages": "true"
              }'

            echo "Connector registered successfully!"

            # Verify connector status
            sleep 5
            curl -s http://kafka-connect:8083/connectors/task-outbox-connector/status | head -50
            EOT
          ]
        }
      }
    }

    backoff_limit = 5
  }

  wait_for_completion = false

  depends_on = [
    kubernetes_deployment.kafka_connect
  ]
}

# -----------------------------------------------------------------------------
# ConfigMap for Connector JSON (alternative approach)
# -----------------------------------------------------------------------------
resource "kubernetes_config_map" "debezium_connector_config" {
  metadata {
    name      = "debezium-connector-config"
    namespace = local.namespace
  }

  data = {
    "task-outbox-connector.json" = jsonencode({
      name = "task-outbox-connector"
      config = {
        "connector.class"           = "io.debezium.connector.mongodb.MongoDbConnector"
        "tasks.max"                 = "1"
        "mongodb.connection.string" = var.mongodb_connection_string
        "mongodb.user"              = var.mongodb_user
        "mongodb.password"          = var.mongodb_password
        "collection.include.list"   = "${var.mongodb_database}.outbox"
        "topic.prefix"              = "task-service"
        "capture.mode"              = "change_streams_update_full"
        "snapshot.mode"             = "initial"

        # Converters
        "key.converter"                 = "org.apache.kafka.connect.json.JsonConverter"
        "key.converter.schemas.enable"  = "false"
        "value.converter"               = "org.apache.kafka.connect.json.JsonConverter"
        "value.converter.schemas.enable" = "false"

        # Outbox Event Router SMT
        "transforms"                                  = "outbox"
        "transforms.outbox.type"                      = "io.debezium.transforms.outbox.EventRouter"
        "transforms.outbox.table.field.event.id"      = "_id"
        "transforms.outbox.table.field.event.key"     = "aggregate_id"
        "transforms.outbox.table.field.event.type"    = "event_type"
        "transforms.outbox.table.field.event.payload" = "payload"
        "transforms.outbox.table.field.event.timestamp" = "created_at"
        "transforms.outbox.route.by.field"            = "aggregate_type"
        "transforms.outbox.route.topic.replacement"   = "events.$${routedByValue}"

        # Delete handling
        "tombstones.on.delete"         = "false"
        "provide.transaction.metadata" = "false"

        # Error handling
        "errors.tolerance"             = "all"
        "errors.log.enable"            = "true"
        "errors.log.include.messages"  = "true"
      }
    })
  }
}
