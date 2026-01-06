# =========================
# ArgoCD Module Outputs
# =========================

output "namespace" {
  description = "ArgoCD namespace"
  value       = kubernetes_namespace.argocd.metadata[0].name
}

output "release_name" {
  description = "ArgoCD Helm release name"
  value       = helm_release.argocd.name
}

output "release_status" {
  description = "ArgoCD Helm release status"
  value       = helm_release.argocd.status
}

output "server_service_name" {
  description = "ArgoCD server service name"
  value       = data.kubernetes_service.argocd_server.metadata[0].name
}

output "server_service_port" {
  description = "ArgoCD server service port"
  value       = try(data.kubernetes_service.argocd_server.spec[0].port[0].port, 80)
}

output "argocd_url" {
  description = "ArgoCD internal cluster URL"
  value       = "http://${var.release_name}-server.${kubernetes_namespace.argocd.metadata[0].name}.svc.cluster.local"
}

output "argocd_external_url" {
  description = "ArgoCD external URL (if ingress is enabled)"
  value       = var.ingress.enabled ? "https://${var.ingress.hostname}" : ""
}

output "redis_enabled" {
  description = "Whether external Redis is enabled"
  value       = var.redis.enabled
}

output "redis_service_name" {
  description = "Redis service name (if enabled)"
  value       = var.redis.enabled ? data.kubernetes_service.argocd_redis[0].metadata[0].name : ""
}

output "admin_username" {
  description = "ArgoCD admin username (always 'admin')"
  value       = "admin"
}