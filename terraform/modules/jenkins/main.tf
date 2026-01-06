# =========================
# Jenkins Module - Main Configuration
# =========================
# This module deploys Jenkins using Helm chart
# with custom configurations for Kubernetes

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

# =========================
# Namespace for Jenkins
# =========================
resource "kubernetes_namespace" "jenkins" {
  metadata {
    name = var.namespace

    labels = {
      name        = var.namespace
      environment = var.environment
      managed-by  = "terraform"
    }
  }
}

# =========================
# Jenkins init groovy ConfigMap
# =========================
resource "kubernetes_config_map" "jenkins_init_groovy" {
  count = var.enable_init_scripts ? 1 : 0

  metadata {
    name      = "jenkins-init-groovy"
    namespace = kubernetes_namespace.jenkins.metadata[0].name

    labels = {
      app        = "jenkins"
      component  = "init-scripts"
      managed-by = "terraform"
    }
  }

  data = var.init_groovy_scripts

  lifecycle {
    create_before_destroy = true
  }
}

# =========================
# Jenkins Helm Release
# =========================
resource "helm_release" "jenkins" {
  name       = var.release_name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "jenkins"
  version    = var.chart_version
  namespace  = kubernetes_namespace.jenkins.metadata[0].name

  # Timeout for installation (Jenkins can take time to start)
  timeout = 600

  # Wait for Jenkins to be ready
  wait = true

  # Values from our custom chart
  values = [
    templatefile("${path.module}/values.yaml.tpl", {
      # Authentication
      jenkins_user     = var.jenkins_user
      jenkins_password = var.jenkins_password

      # Resources
      request_cpu    = var.resources.requests.cpu
      request_memory = var.resources.requests.memory
      limit_cpu      = var.resources.limits.cpu
      limit_memory   = var.resources.limits.memory

      # Volume permissions resources
      volume_permissions_request_cpu    = var.volume_permissions_resources.requests.cpu
      volume_permissions_request_memory = var.volume_permissions_resources.requests.memory
      volume_permissions_limit_cpu      = var.volume_permissions_resources.limits.cpu
      volume_permissions_limit_memory   = var.volume_permissions_resources.limits.memory

      # Init scripts
      init_scripts_cm     = var.enable_init_scripts ? kubernetes_config_map.jenkins_init_groovy[0].metadata[0].name : ""
      init_scripts_secret = ""

      # Persistence
      persistence_enabled      = var.persistence.enabled
      persistence_size         = var.persistence.size
      persistence_storage_class = var.persistence.storage_class

      # Ingress
      ingress_enabled   = var.ingress.enabled
      ingress_hostname  = var.ingress.hostname
      ingress_class     = var.ingress.class_name
      ingress_tls       = var.ingress.tls

      # Service type
      service_type = var.service_type

      # Agent configuration
      agent_enabled      = var.agent.enabled
      agent_container_cap = var.agent.container_cap
      agent_node_selector = var.agent.node_selector
    })
  ]

  depends_on = [
    kubernetes_namespace.jenkins,
    kubernetes_config_map.jenkins_init_groovy
  ]
}

# =========================
# ServiceAccount for Jenkins Agent
# =========================
resource "kubernetes_service_account" "jenkins_agent" {
  count = var.enable_init_scripts ? 1 : 0

  metadata {
    name      = "jenkins-agent"
    namespace = kubernetes_namespace.jenkins.metadata[0].name

    labels = {
      app        = "jenkins"
      component  = "agent"
      managed-by = "terraform"
    }
  }

  depends_on = [kubernetes_namespace.jenkins]
}

# =========================
# Role for Jenkins Agent
# =========================
resource "kubernetes_role" "jenkins_agent_deploy" {
  count = var.enable_init_scripts && var.deployment_namespace != "" ? 1 : 0

  metadata {
    name      = "jenkins-agent-deploy-role"
    namespace = var.deployment_namespace

    labels = {
      app        = "jenkins"
      component  = "agent-rbac"
      managed-by = "terraform"
    }
  }

  rule {
    api_groups = ["apps"]
    resources  = ["deployments"]
    verbs      = ["get", "list", "patch"]
  }

  rule {
    api_groups = [""]
    resources  = ["pods", "pods/log"]
    verbs      = ["get", "list"]
  }
}

# =========================
# RoleBinding for Jenkins Agent
# =========================
resource "kubernetes_role_binding" "jenkins_agent_deploy" {
  count = var.enable_init_scripts && var.deployment_namespace != "" ? 1 : 0

  metadata {
    name      = "jenkins-agent-deploy-binding"
    namespace = var.deployment_namespace

    labels = {
      app        = "jenkins"
      component  = "agent-rbac"
      managed-by = "terraform"
    }
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.jenkins_agent[0].metadata[0].name
    namespace = kubernetes_service_account.jenkins_agent[0].metadata[0].namespace
  }

  role_ref {
    kind      = "Role"
    name      = kubernetes_role.jenkins_agent_deploy[0].metadata[0].name
    api_group = "rbac.authorization.k8s.io"
  }
}
