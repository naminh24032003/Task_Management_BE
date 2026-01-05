# =============================================================================
# Outputs
# =============================================================================

output "namespace" {
  description = "Kubernetes namespace where MongoDB is deployed"
  value       = var.namespace
}

output "release_name" {
  description = "Helm release name"
  value       = helm_release.mongodb_sharded.name
}

output "mongos_service_name" {
  description = "Mongos service name for application connection"
  value       = "${var.release_name}-mongodb-sharded"
}

output "connection_string" {
  description = "MongoDB connection string"
  value       = "mongodb://root:${var.root_password}@${var.release_name}-mongodb-sharded.${var.namespace}.svc.cluster.local:27017"
  sensitive   = true
}

output "mongos_host" {
  description = "Mongos host for application connection"
  value       = "${var.release_name}-mongodb-sharded.${var.namespace}.svc.cluster.local"
}

output "mongos_port" {
  description = "Mongos port"
  value       = 27017
}
