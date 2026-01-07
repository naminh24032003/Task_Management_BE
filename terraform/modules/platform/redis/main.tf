# =============================================================================
# Redis Cluster Platform Module - Main Configuration
# =============================================================================
# This module deploys Redis Cluster using Bitnami Helm chart with:
# - High availability cluster mode
# - Password authentication
# - Configurable topology (nodes + replicas)
# - Optimized for Minikube and EKS
# =============================================================================

# -----------------------------------------------------------------------------
# Namespace
# -----------------------------------------------------------------------------
resource "kubernetes_namespace" "redis" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name = var.namespace
    labels = {
      name        = var.namespace
      environment = var.environment
      managed-by  = "terraform"
    }
  }
}

locals {
  namespace = var.create_namespace ? kubernetes_namespace.redis[0].metadata[0].name : var.namespace
}

# -----------------------------------------------------------------------------
# Redis Password Secret
# -----------------------------------------------------------------------------
resource "kubernetes_secret" "redis_password" {
  metadata {
    name      = "redis-password"
    namespace = local.namespace
  }

  data = {
    "redis-password" = var.redis_password
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# Redis Helm Release (Standalone mode for Minikube)
# -----------------------------------------------------------------------------
resource "helm_release" "redis_cluster" {
  name       = var.release_name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "redis"
  version    = "20.6.0"
  namespace  = local.namespace

  # Allow insecure images for bitnamilegacy
  set {
    name  = "global.security.allowInsecureImages"
    value = "true"
  }

  # Use bitnamilegacy repository
  set {
    name  = "image.repository"
    value = "bitnamilegacy/redis"
  }

  set {
    name  = "image.tag"
    value = "8.2.1-debian-12-r0"
  }

  set {
    name  = "architecture"
    value = var.is_minikube ? "standalone" : "replication"
  }

  set {
    name  = "auth.enabled"
    value = "true"
  }

  set {
    name  = "auth.password"
    value = var.redis_password
  }

  set {
    name  = "master.persistence.enabled"
    value = tostring(var.persistence_enabled)
  }

  set {
    name  = "master.persistence.size"
    value = var.persistence_size
  }

  set {
    name  = "master.resources.requests.cpu"
    value = var.redis_resources.requests.cpu
  }

  set {
    name  = "master.resources.requests.memory"
    value = var.redis_resources.requests.memory
  }

  set {
    name  = "master.resources.limits.cpu"
    value = var.redis_resources.limits.cpu
  }

  set {
    name  = "master.resources.limits.memory"
    value = var.redis_resources.limits.memory
  }

  set {
    name  = "replica.replicaCount"
    value = var.is_minikube ? "0" : tostring(var.redis_replicas)
  }

  set {
    name  = "replica.persistence.enabled"
    value = tostring(var.persistence_enabled)
  }

  set {
    name  = "metrics.enabled"
    value = tostring(var.enable_metrics)
  }

  set {
    name  = "metrics.image.tag"
    value = "latest"
  }

  timeout = 600

  depends_on = [
    kubernetes_secret.redis_password
  ]
}

# -----------------------------------------------------------------------------
# Redis Service Data Source
# -----------------------------------------------------------------------------
data "kubernetes_service" "redis_cluster" {
  metadata {
    name      = "${var.release_name}-master"
    namespace = local.namespace
  }

  depends_on = [helm_release.redis_cluster]
}

# -----------------------------------------------------------------------------
# Redis Connection Info
# -----------------------------------------------------------------------------
locals {
  redis_service = {
    host = "${data.kubernetes_service.redis_cluster.metadata[0].name}.${local.namespace}.svc.cluster.local"
    port = 6379
  }
}
