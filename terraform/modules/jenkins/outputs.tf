# =========================
# Jenkins Module Outputs
# =========================

output "namespace" {
  description = "Jenkins namespace"
  value       = kubernetes_namespace.jenkins.metadata[0].name
}

output "release_name" {
  description = "Jenkins Helm release name"
  value       = helm_release.jenkins.name
}

output "release_status" {
  description = "Jenkins Helm release status"
  value       = helm_release.jenkins.status
}

output "jenkins_service_name" {
  description = "Jenkins service name"
  value       = "${var.release_name}-jenkins"
}

output "jenkins_service_port" {
  description = "Jenkins service HTTP port"
  value       = 80
}

output "jenkins_agent_service_account" {
  description = "Jenkins agent service account name"
  value       = var.enable_init_scripts ? kubernetes_service_account.jenkins_agent[0].metadata[0].name : ""
}

output "jenkins_url" {
  description = "Jenkins URL (internal cluster URL)"
  value       = "http://${var.release_name}-jenkins.${kubernetes_namespace.jenkins.metadata[0].name}.svc.cluster.local"
}

output "jenkins_external_url" {
  description = "Jenkins external URL (if ingress is enabled)"
  value       = var.ingress.enabled ? "https://${var.ingress.hostname}" : ""
}
