// =========================
// Namespace for MongoDB Sharded
// =========================
// Creates a dedicated namespace to isolate all MongoDB sharded
// cluster components (Config Server, Shard Servers, Mongos routers).
resource "kubernetes_namespace" "mongodb_sharded" {
  metadata {
    name = "mongodb-sharded"
  }
}

// =========================
// MongoDB Sharded Helm release
// =========================
// Deploys a MongoDB sharded cluster using the Bitnami Helm chart.
// Configuration is provided via a Terraform-rendered values file,
// including authentication, sharding topology, resource allocation,
// persistence, and node scheduling.
resource "helm_release" "mongodb_sharded" {
  name             = "mongodb-sharded"
  namespace        = kubernetes_namespace.mongodb_sharded.metadata[0].name
  create_namespace = true

  timeout          = 900  // 15 minutes for Minikube startup
  wait             = false  // Don't wait for pods to be ready due to potential slow startup

  // Bitnami MongoDB Sharded chart from Docker Hub OCI registry
  chart   = "oci://registry-1.docker.io/bitnamicharts/mongodb-sharded"
  version = "9.4.12"

  // Use set values instead of large template file
  set {
    name  = "image.registry"
    value = "docker.io"
  }

  set {
    name  = "image.repository"
    value = "bitnamilegacy/mongodb-sharded"
  }

  set {
    name  = "image.tag"
    value = "8.0.12-debian-12-r0"
  }

  set {
    name  = "image.debug"
    value = "false"
  }

  set {
    name  = "auth.enabled"
    value = "true"
  }

  set {
    name  = "auth.rootUser"
    value = var.mongodb_root_username
  }

  set_sensitive {
    name  = "auth.rootPassword"
    value = var.mongodb_root_password
  }

  set {
    name  = "shards"
    value = var.mongodb_shards
  }

  set {
    name  = "configsvr.replicaCount"
    value = var.mongodb_configsvr_replica_count
  }

  set {
    name  = "configsvr.persistence.size"
    value = var.mongodb_configsvr_persistence_size
  }

  set {
    name  = "shardsvr.dataNode.replicaCount"
    value = var.mongodb_shardsvr_replica_count
  }

  set {
    name  = "shardsvr.persistence.size"
    value = var.mongodb_shardsvr_persistence_size
  }

  set {
    name  = "mongos.replicaCount"
    value = var.mongodb_mongos_replica_count
  }

  set {
    name  = "persistence.enabled"
    value = "true"
  }

  // Resource limits
  set {
    name  = "configsvr.resources.requests.cpu"
    value = local.mongodb.configsvr.request_cpu
  }

  set {
    name  = "configsvr.resources.requests.memory"
    value = local.mongodb.configsvr.request_memory
  }

  set {
    name  = "configsvr.resources.limits.cpu"
    value = local.mongodb.configsvr.limit_cpu
  }

  set {
    name  = "configsvr.resources.limits.memory"
    value = local.mongodb.configsvr.limit_memory
  }

  set {
    name  = "shardsvr.dataNode.resources.requests.cpu"
    value = local.mongodb.shardsvr.request_cpu
  }

  set {
    name  = "shardsvr.dataNode.resources.requests.memory"
    value = local.mongodb.shardsvr.request_memory
  }

  set {
    name  = "shardsvr.dataNode.resources.limits.cpu"
    value = local.mongodb.shardsvr.limit_cpu
  }

  set {
    name  = "shardsvr.dataNode.resources.limits.memory"
    value = local.mongodb.shardsvr.limit_memory
  }

  set {
    name  = "mongos.resources.requests.cpu"
    value = local.mongodb.mongos.request_cpu
  }

  set {
    name  = "mongos.resources.requests.memory"
    value = local.mongodb.mongos.request_memory
  }

  set {
    name  = "mongos.resources.limits.cpu"
    value = local.mongodb.mongos.limit_cpu
  }

  set {
    name  = "mongos.resources.limits.memory"
    value = local.mongodb.mongos.limit_memory
  }

  // Ensure the MongoDB namespace exists before installing the chart
  depends_on = [
    kubernetes_namespace.mongodb_sharded
  ]
}

// =========================
// MongoDB Sharded Service
// =========================
// Retrieves the MongoDB Sharded service name.
data "kubernetes_service" "mongodb_sharded" {
  metadata {
    name = "mongodb-sharded"
    namespace = kubernetes_namespace.mongodb_sharded.metadata[0].name
  }
}

// =========================
// MongoDB Sharded Host
// =========================
// Constructs the MongoDB Sharded host name.
locals {
  mongodb_sharded_service = {
    host = "${data.kubernetes_service.mongodb_sharded.metadata[0].name}.${kubernetes_namespace.mongodb_sharded.metadata[0].name}.svc.cluster.local"
    port = 27017
  }
}