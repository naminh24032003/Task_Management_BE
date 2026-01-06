# =========================
# Jenkins Configuration for Minikube
# =========================

module "jenkins" {
  source = "../../modules/jenkins"

  # Basic configuration
  namespace   = "jenkins"
  environment = "dev"

  # Authentication
  jenkins_user     = var.jenkins_user
  jenkins_password = var.jenkins_password

  # Resources (optimized for Minikube)
  resources = {
    requests = {
      cpu    = "250m"
      memory = "256Mi"
    }
    limits = {
      cpu    = "1000m"
      memory = "1024Mi"
    }
  }

  # Volume permissions resources
  volume_permissions_resources = {
    requests = {
      cpu    = "10m"
      memory = "16Mi"
    }
    limits = {
      cpu    = "50m"
      memory = "64Mi"
    }
  }

  # Persistence (using Minikube default storage)
  persistence = {
    enabled       = true
    size          = "5Gi"
    storage_class = "standard"  # Minikube default storage class
  }

  # Service configuration (NodePort for easy access in Minikube)
  service_type = "NodePort"

  # Ingress (disabled for basic Minikube setup)
  ingress = {
    enabled    = false
    hostname   = "jenkins.local"
    class_name = "nginx"
    tls        = false
  }

  # Agent configuration
  agent = {
    enabled       = true
    container_cap = 5  # Limited for Minikube
    node_selector = ""
  }

  # Init scripts (disabled by default)
  enable_init_scripts  = var.enable_jenkins_init_scripts
  init_groovy_scripts  = var.enable_jenkins_init_scripts ? local.jenkins_init_scripts : {}
  deployment_namespace = var.jenkins_deployment_namespace
}

# =========================
# Jenkins Init Scripts (optional)
# =========================
locals {
  jenkins_init_scripts = {
    # Add your init scripts here
    # Example:
    # "kubernetes-cloud.groovy" = templatefile("${path.module}/../../modules/jenkins/scripts/groovy/kubernetes-cloud.groovy.example", {
    #   namespace       = "jenkins"
    #   service_account = "jenkins-agent"
    #   container_cap   = "5"
    #   node_selector   = ""
    # })
  }
}

# =========================
# Outputs
# =========================
output "jenkins_namespace" {
  description = "Jenkins namespace"
  value       = module.jenkins.namespace
}

output "jenkins_url" {
  description = "Jenkins internal URL"
  value       = module.jenkins.jenkins_url
}

output "jenkins_service_name" {
  description = "Jenkins service name"
  value       = module.jenkins.jenkins_service_name
}

output "jenkins_access_info" {
  description = "How to access Jenkins in Minikube"
  value = <<-EOT
    To access Jenkins:
    1. Get the NodePort:
       kubectl get svc -n ${module.jenkins.namespace} ${module.jenkins.jenkins_service_name} -o jsonpath='{.spec.ports[0].nodePort}'

    2. Get Minikube IP:
       minikube ip

    3. Access Jenkins at: http://<minikube-ip>:<node-port>

    Or use port forwarding:
       kubectl port-forward -n ${module.jenkins.namespace} svc/${module.jenkins.jenkins_service_name} 8080:80
       Then access at: http://localhost:8080

    Login credentials:
       Username: ${var.jenkins_user}
       Password: <your-jenkins-password>
  EOT
}