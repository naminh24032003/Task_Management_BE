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
# MongoDB Sharded
# -----------------------------------------------------------------------------

output "mongodb" {
  description = "MongoDB Sharded cluster information"
  value = var.mongodb_enabled ? {
    namespace    = module.mongodb_sharded[0].namespace
    release_name = module.mongodb_sharded[0].release_name
    mongos_host  = module.mongodb_sharded[0].mongos_host
    mongos_port  = module.mongodb_sharded[0].mongos_port
    service_name = module.mongodb_sharded[0].mongos_service_name
  } : null
}

output "mongodb_connection_string" {
  description = "MongoDB connection string (sensitive)"
  value       = var.mongodb_enabled ? module.mongodb_sharded[0].connection_string : null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Kafka
# -----------------------------------------------------------------------------

output "kafka" {
  description = "Kafka cluster information"
  value = var.kafka_enabled ? {
    namespace           = module.kafka[0].namespace
    bootstrap_servers   = module.kafka[0].kafka_bootstrap_servers
    kafka_ui_url        = module.kafka[0].kafka_ui_url
    sasl_username       = module.kafka[0].sasl_user
  } : null
}

output "kafka_connection" {
  description = "Kafka connection details"
  value       = var.kafka_enabled ? module.kafka[0].kafka_connection_string : null
  sensitive   = false
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
    
    # Port-forward MongoDB:
    kubectl port-forward -n mongodb svc/mongodb-sharded 27017:27017
    # Connect: mongosh mongodb://root:<password>@localhost:27017

    # Port-forward Kafka UI:
    kubectl port-forward -n kafka svc/kafka-ui 8080:8080
    # Open: http://localhost:8080

    # Test Kafka connection:
    kubectl run kafka-client --rm -ti --image=bitnami/kafka:latest -- bash
    # Then: kafka-console-producer.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 ...
  EOT
}
