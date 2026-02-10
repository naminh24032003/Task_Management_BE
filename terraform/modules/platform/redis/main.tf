# =============================================================================
# Redis Cluster Platform Module - Main Configuration
# =============================================================================
# This module deploys a true Redis Cluster using Bitnami redis-cluster chart:
# - True cluster mode with hash slot sharding
# - Multi-master architecture
# - Password authentication
# - Minikube: 3 masters, 0 replicas
# - EKS: 6 nodes (3 masters + 3 replicas)
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
# Redis Cluster Helm Release (True cluster mode)
# -----------------------------------------------------------------------------
resource "helm_release" "redis_cluster" {
  name       = var.release_name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "redis-cluster"
  version    = var.chart_version
  namespace  = local.namespace

  # Keep service name clean
  set {
    name  = "fullnameOverride"
    value = "redis-cluster"
  }

  # Cluster topology
  set {
    name  = "cluster.nodes"
    value = var.is_minikube ? "3" : tostring(var.redis_nodes)
  }

  set {
    name  = "cluster.replicas"
    value = var.is_minikube ? "0" : tostring(var.redis_replicas)
  }

  # Authentication
  set {
    name  = "password"
    value = var.redis_password
  }

  set {
    name  = "usePassword"
    value = "true"
  }

  # Persistence
  set {
    name  = "persistence.enabled"
    value = tostring(var.persistence_enabled)
  }

  set {
    name  = "persistence.size"
    value = var.persistence_size
  }

  # Resources per node
  set {
    name  = "redis.resources.requests.cpu"
    value = var.redis_resources.requests.cpu
  }

  set {
    name  = "redis.resources.requests.memory"
    value = var.redis_resources.requests.memory
  }

  set {
    name  = "redis.resources.limits.cpu"
    value = var.redis_resources.limits.cpu
  }

  set {
    name  = "redis.resources.limits.memory"
    value = var.redis_resources.limits.memory
  }

  # Metrics
  set {
    name  = "metrics.enabled"
    value = tostring(var.enable_metrics)
  }

  set {
    name  = "metrics.image.tag"
    value = "latest"
  }

  # Cluster configuration
  set {
    name  = "redis.configmap"
    value = "maxmemory-policy ${var.maxmemory_policy}\nappendonly yes\nappendfsync everysec"
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
    name      = "redis-cluster"
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

# -----------------------------------------------------------------------------
# Redis Commander UI (Optional)
# Web UI to view and manage Redis cache data
# -----------------------------------------------------------------------------
resource "kubernetes_deployment" "redis_commander" {
  count = var.enable_redis_commander ? 1 : 0

  metadata {
    name      = "redis-commander"
    namespace = local.namespace
    labels = {
      app         = "redis-commander"
      environment = var.environment
      managed-by  = "terraform"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "redis-commander"
      }
    }

    template {
      metadata {
        labels = {
          app = "redis-commander"
        }
      }

      spec {
        container {
          name  = "redis-commander"
          image = "rediscommander/redis-commander:latest"

          port {
            container_port = 8081
            name           = "http"
          }

          env {
            name  = "REDIS_HOST"
            value = local.redis_service.host
          }

          env {
            name  = "REDIS_PORT"
            value = tostring(local.redis_service.port)
          }

          env {
            name  = "REDIS_PASSWORD"
            value = var.redis_password
          }

          resources {
            requests = {
              cpu    = var.redis_commander_resources.requests.cpu
              memory = var.redis_commander_resources.requests.memory
            }
            limits = {
              cpu    = var.redis_commander_resources.limits.cpu
              memory = var.redis_commander_resources.limits.memory
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 8081
            }
            initial_delay_seconds = 10
            period_seconds        = 30
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 8081
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [helm_release.redis_cluster]
}

resource "kubernetes_service" "redis_commander" {
  count = var.enable_redis_commander ? 1 : 0

  metadata {
    name      = "redis-commander"
    namespace = local.namespace
    labels = {
      app         = "redis-commander"
      environment = var.environment
      managed-by  = "terraform"
    }
  }

  spec {
    type = "ClusterIP"

    port {
      port        = 8081
      target_port = 8081
      name        = "http"
    }

    selector = {
      app = "redis-commander"
    }
  }
}
