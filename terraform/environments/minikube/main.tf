# =============================================================================
# Minikube Environment - Main Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Monitoring Module (Prometheus + Grafana + Alertmanager)
# -----------------------------------------------------------------------------

module "monitoring" {
  source = "../../modules/platform/monitoring"
  count  = var.monitoring_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "monitoring"
  create_namespace = true

  # Prometheus
  prometheus_enabled       = true
  prometheus_chart_version = "56.6.2"
  prometheus_retention     = "7d"
  prometheus_storage_enabled = false  # No PV for minikube
  prometheus_resources = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { cpu = "500m", memory = "512Mi" }
  }

  # Alertmanager
  alertmanager_enabled       = true
  alertmanager_storage_enabled = false
  alertmanager_resources = {
    requests = { cpu = "10m", memory = "32Mi" }
    limits   = { cpu = "100m", memory = "64Mi" }
  }

  # Grafana
  grafana_enabled        = true
  grafana_admin_password = "prom-operator"
  grafana_storage_enabled = false
  grafana_resources = {
    requests = { cpu = "50m", memory = "128Mi" }
    limits   = { cpu = "200m", memory = "256Mi" }
  }

  service_type = "ClusterIP"
}

# -----------------------------------------------------------------------------
# Logging Module (Loki + Promtail)
# -----------------------------------------------------------------------------

module "logging" {
  source = "../../modules/platform/logging"
  count  = var.logging_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "logging"
  create_namespace = true

  # Loki
  loki_enabled       = true
  loki_chart_version = "2.10.2"
  loki_retention_period = "168h"  # 7 days
  loki_storage_enabled = false   # No PV for minikube
  loki_resources = {
    requests = { cpu = "50m", memory = "128Mi" }
    limits   = { cpu = "200m", memory = "256Mi" }
  }

  # Promtail
  promtail_enabled = true
  promtail_resources = {
    requests = { cpu = "20m", memory = "64Mi" }
    limits   = { cpu = "100m", memory = "128Mi" }
  }

  # Grafana integration
  grafana_datasource_enabled = true
  grafana_namespace          = "monitoring"

  depends_on = [module.monitoring]
}

# -----------------------------------------------------------------------------
# Istio Module (Service Mesh)
# -----------------------------------------------------------------------------

module "istio" {
  source = "../../modules/platform/istio"
  count  = var.istio_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "dev"
  istio_namespace  = "istio-system"
  create_namespace = false  # dev namespace already exists

  # Istio versions
  istio_base_chart_version = "1.22.0"
  istiod_chart_version     = "1.22.0"
  istio_profile            = "minimal"

  # Resources (light for minikube)
  istiod_resources = {
    requests = { cpu = "100m", memory = "128Mi" }
    limits   = { cpu = "300m", memory = "384Mi" }
  }
  proxy_resources = {
    requests = { cpu = "10m", memory = "40Mi" }
    limits   = { cpu = "100m", memory = "128Mi" }
  }

  # Services in mesh
  services = {
    task-service = {
      name      = "task-service"
      host      = "task-service.dev.svc.cluster.local"
      port      = 8080
      grpc_port = 9090
      versions  = ["v1"]
    }
    user-service = {
      name      = "user-service"
      host      = "user-service.dev.svc.cluster.local"
      port      = 3000
      grpc_port = 9090
      versions  = ["v1"]
    }
  }

  # Traffic management
  traffic_management_enabled = true
  timeout                    = "10s"
  retry_attempts             = 3

  # Security
  mtls_enabled         = true
  mtls_mode            = "STRICT"
  authorization_enabled = true

  # Observability
  tracing_enabled          = true
  tracing_sampling_rate    = 100
  metrics_enabled          = true
  grafana_dashboards_enabled = true

  # Integration
  monitoring_namespace = "monitoring"
  prometheus_release   = "monitoring"
  
  # Kong excluded from mesh
  kong_exclude_from_mesh = true
  kong_namespace         = "kong"

  depends_on = [module.monitoring]
}

# -----------------------------------------------------------------------------
# MongoDB Sharded Module - User Service
# -----------------------------------------------------------------------------

module "mongodb_user_service" {
  source = "../../modules/platform/mongodb_sharded"
  count  = var.mongodb_enabled ? 1 : 0

  # Deployment config
  namespace    = "mongodb-user"
  release_name = "user-mongodb"

  # Authentication
  mongodb_root_username   = "root"
  mongodb_root_password   = var.mongodb_root_password
  mongodb_replica_set_key = var.mongodb_replica_set_key

  # Cluster Configuration (3 shards for 3 tenants: HCM, DN, HN)
  mongodb_shards                  = 3
  mongodb_configsvr_replica_count = 1
  mongodb_shardsvr_replica_count  = 1
  mongodb_mongos_replica_count    = 1

  # Persistence
  mongodb_configsvr_persistence_size = "2Gi"
  mongodb_shardsvr_persistence_size  = "8Gi"

  # Node scheduling
  kubernetes_primary_node_pool_name = "minikube"
}

# -----------------------------------------------------------------------------
# MongoDB Sharded Module - Task Service
# -----------------------------------------------------------------------------

module "mongodb_task_service" {
  source = "../../modules/platform/mongodb_sharded"
  count  = var.mongodb_enabled ? 1 : 0

  # Deployment config
  namespace    = "mongodb-task"
  release_name = "task-mongodb"

  # Authentication
  mongodb_root_username   = "root"
  mongodb_root_password   = var.mongodb_root_password
  mongodb_replica_set_key = var.mongodb_replica_set_key

  # Cluster Configuration (minimal for Minikube)
  mongodb_shards                  = 1
  mongodb_configsvr_replica_count = 1
  mongodb_shardsvr_replica_count  = 1
  mongodb_mongos_replica_count    = 1

  # Persistence
  mongodb_configsvr_persistence_size = "2Gi"
  mongodb_shardsvr_persistence_size  = "8Gi"

  # Node scheduling
  kubernetes_primary_node_pool_name = "minikube"
}


# -----------------------------------------------------------------------------
# Kafka Module
# -----------------------------------------------------------------------------

module "kafka" {
  source = "../../modules/platform/kafka"
  count  = var.kafka_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "kafka"
  create_namespace = true

  # Helm configuration
  release_name  = "kafka"
  chart_version = "31.0.0"

  # Authentication
  sasl_user     = "kafka-user"
  sasl_password = var.kafka_sasl_password

  # Controller (KRaft mode - minimal for minikube)
  controller_replica_count = 1
  controller_resources = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { cpu = "500m", memory = "512Mi" }
  }
  controller_persistence_size     = "2Gi"
  controller_log_persistence_size = "1Gi"

  # Broker (0 for KRaft mode - controller acts as broker)
  broker_replica_count = 0

  # Storage
  persistence_enabled = var.kafka_persistence_enabled
  storage_class       = "" # Use minikube default

  # Volume permissions (required for minikube)
  volume_permissions_enabled = true
  volume_permissions_resources = {
    requests = { cpu = "10m", memory = "32Mi" }
    limits   = { cpu = "50m", memory = "64Mi" }
  }

  # Kafka UI
  kafka_ui_enabled = true
  kafka_ui_image   = "provectuslabs/kafka-ui:latest"
  kafka_ui_resources = {
    requests = { cpu = "50m", memory = "128Mi" }
    limits   = { cpu = "200m", memory = "256Mi" }
  }

  # Network
  service_type = "ClusterIP"

  # Platform
  is_minikube = true
}

# -----------------------------------------------------------------------------
# Redis Cluster Module
# -----------------------------------------------------------------------------

module "redis" {
  source = "../../modules/platform/redis"
  count  = var.redis_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "redis"
  create_namespace = true

  # Helm configuration
  release_name  = "redis-cluster"
  chart_version = "11.0.7"

  # Authentication
  redis_password = var.redis_password

  # Cluster topology (minimal for minikube)
  redis_nodes    = 6  # Minimum for cluster mode
  redis_replicas = 1  # 1 replica per primary

  # Resources (optimized for minikube)
  redis_resources = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { cpu = "200m", memory = "512Mi" }
  }

  # Storage
  persistence_enabled = var.redis_persistence_enabled
  persistence_size    = "2Gi"
  storage_class       = ""  # Use minikube default

  # Platform
  is_minikube = true

  # Redis configuration
  maxmemory_policy = "allkeys-lru"
  enable_metrics   = true
}
