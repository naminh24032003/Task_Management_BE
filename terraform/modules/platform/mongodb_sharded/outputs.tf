output "namespace" {
  description = "MongoDB Sharded namespace"
  value       = kubernetes_namespace.mongodb_sharded.metadata[0].name
}

output "service_host" {
  description = "MongoDB Sharded service host"
  value       = local.mongodb_sharded_service.host
}

output "service_port" {
  description = "MongoDB Sharded service port"
  value       = local.mongodb_sharded_service.port
}

output "connection_string" {
  description = "MongoDB connection string"
  value       = "mongodb://${var.mongodb_root_username}:${var.mongodb_root_password}@${local.mongodb_sharded_service.host}:${local.mongodb_sharded_service.port}/?authSource=admin"
  sensitive   = true
}
