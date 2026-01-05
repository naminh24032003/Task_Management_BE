# =============================================================================
# Locals - Resource Presets
# Based on mongo_shard/mongodb_sharded_variables.tf resource presets
# NOTE: MongoDB 8.x requires minimum 256-512MB RAM to start properly
# =============================================================================

locals {
  # Resource presets for different component sizes
  # Format: { request_cpu, request_memory, limit_cpu, limit_memory }
  
  resource_presets = {
    nano = {
      request_cpu    = "100m"
      request_memory = "512Mi"
      limit_cpu      = "300m"
      limit_memory   = "1Gi"
    }
    micro = {
      request_cpu    = "150m"
      request_memory = "512Mi"
      limit_cpu      = "400m"
      limit_memory   = "1Gi"
    }
    small = {
      request_cpu    = "200m"
      request_memory = "768Mi"
      limit_cpu      = "500m"
      limit_memory   = "1536Mi"
    }
    medium = {
      request_cpu    = "400m"
      request_memory = "1Gi"
      limit_cpu      = "1000m"
      limit_memory   = "2Gi"
    }
    large = {
      request_cpu    = "800m"
      request_memory = "2Gi"
      limit_cpu      = "2000m"
      limit_memory   = "4Gi"
    }
  }

  # Get resource configurations from presets
  configsvr_resources = local.resource_presets[var.configsvr_resources_preset]
  shardsvr_resources  = local.resource_presets[var.shardsvr_resources_preset]
  mongos_resources    = local.resource_presets[var.mongos_resources_preset]

  # Node selector configuration (empty for minikube)
  node_selector = var.is_minikube ? {} : {
    "doks.digitalocean.com/node-pool" = var.node_pool_label
  }

  # Helm values
  helm_values = templatefile("${path.module}/values/mongodb-sharded.yaml", {
    # Image configuration
    image_registry    = var.image_registry
    image_repository  = var.image_repository
    image_tag         = var.image_tag
    image_pull_policy = var.image_pull_policy

    # Volume permissions
    volume_permissions_enabled          = var.volume_permissions_enabled
    volume_permissions_image_registry   = var.volume_permissions_image_registry
    volume_permissions_image_repository = var.volume_permissions_image_repository
    volume_permissions_image_tag        = var.volume_permissions_image_tag

    # Authentication
    root_password   = var.root_password
    replica_set_key = var.replica_set_key

    # Cluster configuration
    shard_count             = var.shard_count
    configsvr_replica_count = var.configsvr_replica_count
    shardsvr_replica_count  = var.shardsvr_replica_count
    mongos_replica_count    = var.mongos_replica_count

    # ConfigServer resources
    configsvr_request_cpu    = local.configsvr_resources.request_cpu
    configsvr_request_memory = local.configsvr_resources.request_memory
    configsvr_limit_cpu      = local.configsvr_resources.limit_cpu
    configsvr_limit_memory   = local.configsvr_resources.limit_memory

    # ShardServer resources
    shardsvr_request_cpu    = local.shardsvr_resources.request_cpu
    shardsvr_request_memory = local.shardsvr_resources.request_memory
    shardsvr_limit_cpu      = local.shardsvr_resources.limit_cpu
    shardsvr_limit_memory   = local.shardsvr_resources.limit_memory

    # Mongos resources
    mongos_request_cpu    = local.mongos_resources.request_cpu
    mongos_request_memory = local.mongos_resources.request_memory
    mongos_limit_cpu      = local.mongos_resources.limit_cpu
    mongos_limit_memory   = local.mongos_resources.limit_memory

    # Persistence
    persistence_enabled        = var.persistence_enabled
    storage_class              = var.storage_class
    configsvr_persistence_size = var.configsvr_persistence_size
    shardsvr_persistence_size  = var.shardsvr_persistence_size

    # Network
    service_type           = var.service_type
    network_policy_enabled = var.network_policy_enabled

    # Node selector (empty for minikube)
    use_node_selector = !var.is_minikube
    node_pool_label   = var.node_pool_label

    # Metrics
    metrics_enabled = var.metrics_enabled
  })
}
