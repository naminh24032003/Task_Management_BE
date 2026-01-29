# =============================================================================
# Redis Cluster Module - Outputs
# =============================================================================

output "namespace" {
  description = "Redis namespace"
  value       = local.namespace
}

output "release_name" {
  description = "Redis Helm release name"
  value       = var.release_name
}

output "redis_host" {
  description = "Redis cluster host"
  value       = local.redis_service.host
}

output "redis_port" {
  description = "Redis cluster port"
  value       = local.redis_service.port
}

output "redis_connection_string" {
  description = "Full Redis connection string"
  value       = "${local.redis_service.host}:${local.redis_service.port}"
}

output "redis_nodes" {
  description = "Number of Redis nodes"
  value       = var.redis_nodes
}

output "redis_replicas" {
  description = "Number of replicas per primary"
  value       = var.redis_replicas
}

output "service_name" {
  description = "Redis service name"
  value       = data.kubernetes_service.redis_cluster.metadata[0].name
}

output "connection_info" {
  description = "Complete Redis connection information"
  value = {
    host     = local.redis_service.host
    port     = local.redis_service.port
    nodes    = var.redis_nodes
    replicas = var.redis_replicas
  }
  sensitive = false
}

# -----------------------------------------------------------------------------
# Redis Commander Outputs
# -----------------------------------------------------------------------------
output "redis_commander_enabled" {
  description = "Whether Redis Commander UI is enabled"
  value       = var.enable_redis_commander
}

output "redis_commander_url" {
  description = "Redis Commander UI internal URL (use kubectl port-forward to access)"
  value       = var.enable_redis_commander ? "http://redis-commander.${local.namespace}.svc.cluster.local:8081" : null
}

output "redis_commander_port_forward_command" {
  description = "Command to port-forward Redis Commander UI"
  value       = var.enable_redis_commander ? "kubectl port-forward svc/redis-commander -n ${local.namespace} 8081:8081" : null
}
