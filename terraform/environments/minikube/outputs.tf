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

output "mongodb_user_service" {
  description = "MongoDB cluster for User Service"
  value = var.mongodb_enabled ? {
    namespace     = module.mongodb_user_service[0].namespace
    service_host  = module.mongodb_user_service[0].service_host
    service_port  = module.mongodb_user_service[0].service_port
  } : null
}

output "mongodb_user_service_connection_string" {
  description = "MongoDB User Service connection string (sensitive)"
  value       = var.mongodb_enabled ? module.mongodb_user_service[0].connection_string : null
  sensitive   = true
}

output "mongodb_task_service" {
  description = "MongoDB cluster for Task Service"
  value = var.mongodb_enabled ? {
    namespace     = module.mongodb_task_service[0].namespace
    service_host  = module.mongodb_task_service[0].service_host
    service_port  = module.mongodb_task_service[0].service_port
  } : null
}

output "mongodb_task_service_connection_string" {
  description = "MongoDB Task Service connection string (sensitive)"
  value       = var.mongodb_enabled ? module.mongodb_task_service[0].connection_string : null
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
# Redis
# -----------------------------------------------------------------------------

output "redis" {
  description = "Redis cluster information"
  value = var.redis_enabled ? {
    namespace          = module.redis[0].namespace
    connection_string  = module.redis[0].redis_connection_string
    nodes              = module.redis[0].redis_nodes
    replicas           = module.redis[0].redis_replicas
  } : null
}

output "redis_connection" {
  description = "Redis connection details"
  value       = var.redis_enabled ? module.redis[0].connection_info : null
  sensitive   = false
}

# -----------------------------------------------------------------------------
# Tracing
# -----------------------------------------------------------------------------

output "tracing" {
  description = "Distributed tracing information"
  value = var.tracing_enabled ? {
    namespace                    = module.tracing[0].namespace
    tempo_endpoint               = module.tracing[0].tempo_endpoint
    tempo_query_url              = module.tracing[0].tempo_query_url
    otel_collector_grpc_endpoint = module.tracing[0].otel_collector_grpc_endpoint
    otel_collector_http_endpoint = module.tracing[0].otel_collector_http_endpoint
    kong_plugin_name             = module.tracing[0].kong_plugin_name
  } : null
}

output "tracing_service_env_vars" {
  description = "Environment variables to add to services for tracing"
  value       = var.tracing_enabled ? module.tracing[0].service_environment_variables : {}
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

    # Port-forward Tempo (Tracing):
    kubectl port-forward -n tracing svc/tempo 3100:3100
    # Open: http://localhost:3100
    # View traces in Grafana -> Explore -> Tempo datasource
    
    # Port-forward MongoDB:
    kubectl port-forward -n mongodb svc/mongodb-sharded 27017:27017
    # Connect: mongosh mongodb://root:<password>@localhost:27017

    # Port-forward Kafka UI:
    kubectl port-forward -n kafka svc/kafka-ui 8080:8080
    # Open: http://localhost:8080

    # Test Kafka connection:
    kubectl run kafka-client --rm -ti --image=bitnami/kafka:latest -- bash
    # Then: kafka-console-producer.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 ...

    # Test Redis connection:
    kubectl run redis-client --rm -ti --image=bitnami/redis-cluster:latest -- bash
    # Then: redis-cli -c -h redis-cluster.redis.svc.cluster.local -a <password>
  EOT
}
