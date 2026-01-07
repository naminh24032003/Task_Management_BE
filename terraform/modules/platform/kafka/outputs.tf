# =============================================================================
# Kafka Module - Outputs
# =============================================================================

output "namespace" {
  description = "Kafka namespace"
  value       = local.namespace
}

output "kafka_service_name" {
  description = "Kafka service name"
  value       = data.kubernetes_service.kafka.metadata[0].name
}

output "kafka_host" {
  description = "Kafka bootstrap server host"
  value       = "${data.kubernetes_service.kafka.metadata[0].name}.${local.namespace}.svc.cluster.local"
}

output "kafka_port" {
  description = "Kafka bootstrap server port"
  value       = 9092
}

output "kafka_bootstrap_servers" {
  description = "Full Kafka bootstrap servers connection string"
  value       = "${data.kubernetes_service.kafka.metadata[0].name}.${local.namespace}.svc.cluster.local:9092"
}

output "kafka_ui_service_name" {
  description = "Kafka UI service name"
  value       = var.kafka_ui_enabled ? kubernetes_service.kafka_ui[0].metadata[0].name : null
}

output "kafka_ui_url" {
  description = "Kafka UI internal URL"
  value       = var.kafka_ui_enabled ? "http://kafka-ui.${local.namespace}.svc.cluster.local:8080" : null
}

output "sasl_user" {
  description = "Kafka SASL username"
  value       = var.sasl_user
}

output "kafka_connection_string" {
  description = "Complete Kafka connection string with SASL settings"
  value = {
    bootstrap_servers  = "${data.kubernetes_service.kafka.metadata[0].name}.${local.namespace}.svc.cluster.local:9092"
    security_protocol  = "SASL_PLAINTEXT"
    sasl_mechanism     = "SCRAM-SHA-256"
    sasl_username      = var.sasl_user
  }
  sensitive = false
}
