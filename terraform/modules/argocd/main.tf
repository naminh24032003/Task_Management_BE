# =========================
# ArgoCD Module - Main Configuration
# =========================
# This module deploys ArgoCD (GitOps CD tool) using Helm charts
# with Redis for caching and optional Git repository configuration

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
    argocd = {
      source  = "oboukili/argocd"
      version = "~> 6.0"
    }
  }
}

# =========================
# Namespace for ArgoCD
# =========================
resource "kubernetes_namespace" "argocd" {
  metadata {
    name = var.namespace

    labels = {
      name        = var.namespace
      environment = var.environment
      managed-by  = "terraform"
      app         = "argocd"
    }
  }
}

# =========================
# Redis for ArgoCD (External)
# =========================
# ArgoCD uses Redis for caching and high availability
resource "helm_release" "argocd_redis" {
  count = var.redis.enabled ? 1 : 0

  name       = "${var.release_name}-redis"
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "redis"
  version    = var.redis.chart_version
  namespace  = kubernetes_namespace.argocd.metadata[0].name

  timeout = 600
  wait    = true

  values = [
    templatefile("${path.module}/redis-values.yaml.tpl", {
      password       = var.redis.password
      request_cpu    = var.redis.resources.requests.cpu
      request_memory = var.redis.resources.requests.memory
      limit_cpu      = var.redis.resources.limits.cpu
      limit_memory   = var.redis.resources.limits.memory
    })
  ]

  depends_on = [kubernetes_namespace.argocd]
}

# Get Redis service for ArgoCD configuration
data "kubernetes_service" "argocd_redis" {
  count = var.redis.enabled ? 1 : 0

  metadata {
    name      = "${var.release_name}-redis-master"
    namespace = kubernetes_namespace.argocd.metadata[0].name
  }

  depends_on = [helm_release.argocd_redis]
}

# =========================
# ArgoCD Helm Release
# =========================
resource "helm_release" "argocd" {
  name       = var.release_name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "argo-cd"
  version    = var.chart_version
  namespace  = kubernetes_namespace.argocd.metadata[0].name

  timeout = 600
  wait    = true

  values = [
    templatefile("${path.module}/argocd-values.yaml.tpl", {
      # Admin credentials
      admin_password = var.admin_password

      # Controller configuration
      controller_replica_count  = var.controller.replica_count
      controller_request_cpu    = var.controller.resources.requests.cpu
      controller_request_memory = var.controller.resources.requests.memory
      controller_limit_cpu      = var.controller.resources.limits.cpu
      controller_limit_memory   = var.controller.resources.limits.memory

      # Server configuration
      server_request_cpu    = var.server.resources.requests.cpu
      server_request_memory = var.server.resources.requests.memory
      server_limit_cpu      = var.server.resources.limits.cpu
      server_limit_memory   = var.server.resources.limits.memory

      # Repo server configuration
      repo_server_request_cpu    = var.repo_server.resources.requests.cpu
      repo_server_request_memory = var.repo_server.resources.requests.memory
      repo_server_limit_cpu      = var.repo_server.resources.limits.cpu
      repo_server_limit_memory   = var.repo_server.resources.limits.memory

      # ApplicationSet controller
      application_set_request_cpu    = var.application_set.resources.requests.cpu
      application_set_request_memory = var.application_set.resources.requests.memory
      application_set_limit_cpu      = var.application_set.resources.limits.cpu
      application_set_limit_memory   = var.application_set.resources.limits.memory

      # Notifications controller
      notifications_request_cpu    = var.notifications.resources.requests.cpu
      notifications_request_memory = var.notifications.resources.requests.memory
      notifications_limit_cpu      = var.notifications.resources.limits.cpu
      notifications_limit_memory   = var.notifications.resources.limits.memory

      # Redis configuration
      redis_enabled  = var.redis.enabled
      redis_host     = var.redis.enabled ? data.kubernetes_service.argocd_redis[0].metadata[0].name : ""
      redis_password = var.redis.enabled ? var.redis.password : ""

      # Service type
      service_type = var.service_type

      # Ingress
      ingress_enabled   = var.ingress.enabled
      ingress_hostname  = var.ingress.hostname
      ingress_class     = var.ingress.class_name
      ingress_tls       = var.ingress.tls
    })
  ]

  depends_on = [
    kubernetes_namespace.argocd,
    helm_release.argocd_redis
  ]
}

# =========================
# ArgoCD Server Service (for ingress)
# =========================
data "kubernetes_service" "argocd_server" {
  metadata {
    name      = "${var.release_name}-server"
    namespace = kubernetes_namespace.argocd.metadata[0].name
  }

  depends_on = [helm_release.argocd]
}