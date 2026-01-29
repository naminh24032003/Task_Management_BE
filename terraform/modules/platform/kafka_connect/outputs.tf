# =============================================================================
# Kafka Connect Module - Outputs
# =============================================================================

output "namespace" {
  description = "Namespace where Kafka Connect is deployed"
  value       = local.namespace
}

output "service_name" {
  description = "Kafka Connect service name"
  value       = kubernetes_service.kafka_connect.metadata[0].name
}

output "service_url" {
  description = "Kafka Connect REST API URL"
  value       = "http://${kubernetes_service.kafka_connect.metadata[0].name}.${local.namespace}.svc.cluster.local:8083"
}

output "connector_name" {
  description = "Name of the registered Debezium connector"
  value       = "task-outbox-connector"
}
