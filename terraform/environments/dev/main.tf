# =============================================================================
# Dev Environment - Main Configuration (EKS on AWS)
# =============================================================================

locals {
  cluster_name = "${var.project_name}-${var.environment}"
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# -----------------------------------------------------------------------------
# ECR Repositories (Docker Image Registry)
# -----------------------------------------------------------------------------
module "ecr" {
  source = "../../modules/ecr"

  project_name = var.project_name
  service_names = [
    "user-service",
    "task-service",
    "notification-service",
    "bff-service",
  ]
  scan_on_push          = true
  image_retention_count = 10
  tags                  = local.common_tags
}

# -----------------------------------------------------------------------------
# Networking (VPC, Subnets, NAT Gateway)
# -----------------------------------------------------------------------------
module "network" {
  source = "../../modules/network"

  cluster_name       = local.cluster_name
  vpc_cidr           = var.vpc_cidr
  az_count           = var.az_count
  enable_nat_gateway = true
  tags               = local.common_tags
}

# -----------------------------------------------------------------------------
# EKS Cluster + Node Groups
# -----------------------------------------------------------------------------
module "eks" {
  source = "../../modules/eks"

  cluster_name       = local.cluster_name
  kubernetes_version = var.kubernetes_version
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids

  endpoint_public_access = true
  enabled_log_types      = ["api", "audit", "authenticator"]

  # General node group (application services)
  general_instance_types = var.general_instance_types
  general_capacity_type  = var.general_capacity_type
  general_desired_size   = var.general_desired_size
  general_min_size       = var.general_min_size
  general_max_size       = var.general_max_size

  # Platform node group (MongoDB, Kafka, Redis)
  enable_platform_nodegroup = var.enable_platform_nodegroup
  platform_instance_types   = var.platform_instance_types
  platform_desired_size     = var.platform_desired_size
  platform_min_size         = var.platform_min_size
  platform_max_size         = var.platform_max_size

  tags = local.common_tags

  depends_on = [module.network]
}

# -----------------------------------------------------------------------------
# Platform Services (Helm releases on EKS)
# Deploy after EKS is ready using the platform modules
# -----------------------------------------------------------------------------

# Monitoring (Prometheus + Grafana)
module "monitoring" {
  source = "../../modules/platform/monitoring"
  count  = var.monitoring_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "monitoring"
  create_namespace = true

  prometheus_enabled         = true
  prometheus_chart_version   = "56.6.2"
  prometheus_retention       = "15d"
  prometheus_storage_enabled = true
  prometheus_resources = {
    requests = { cpu = "200m", memory = "512Mi" }
    limits   = { cpu = "1000m", memory = "2Gi" }
  }

  alertmanager_enabled         = true
  alertmanager_storage_enabled = true
  alertmanager_resources = {
    requests = { cpu = "50m", memory = "64Mi" }
    limits   = { cpu = "200m", memory = "256Mi" }
  }

  grafana_enabled         = true
  grafana_admin_password  = var.grafana_admin_password
  grafana_storage_enabled = true
  grafana_resources = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { cpu = "500m", memory = "512Mi" }
  }

  service_type = "ClusterIP"

  depends_on = [module.eks]
}

# Logging (Loki + Promtail)
module "logging" {
  source = "../../modules/platform/logging"
  count  = var.logging_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "logging"
  create_namespace = true

  loki_enabled          = true
  loki_chart_version    = "2.10.2"
  loki_retention_period = "168h"
  loki_storage_enabled  = true
  loki_resources = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { cpu = "500m", memory = "512Mi" }
  }

  promtail_enabled = true
  promtail_resources = {
    requests = { cpu = "50m", memory = "128Mi" }
    limits   = { cpu = "200m", memory = "256Mi" }
  }

  grafana_datasource_enabled = true
  grafana_namespace          = "monitoring"

  depends_on = [module.monitoring, module.eks]
}

# Tracing (Tempo + OpenTelemetry Collector)
module "tracing" {
  source = "../../modules/platform/tracing"
  count  = var.tracing_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "tracing"
  create_namespace = true

  tempo_enabled         = true
  tempo_chart_version   = "1.7.2"
  tempo_retention       = "72h"
  tempo_storage_enabled = true
  tempo_resources = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { cpu = "500m", memory = "512Mi" }
  }

  otel_collector_enabled   = true
  otel_collector_image     = "otel/opentelemetry-collector-contrib"
  otel_collector_image_tag = "0.91.0"
  otel_collector_replicas  = 1
  otel_collector_resources = {
    requests = { cpu = "50m", memory = "128Mi" }
    limits   = { cpu = "300m", memory = "256Mi" }
  }

  kong_plugin_enabled = true
  kong_plugin_global  = true
  kong_namespace      = "kong"

  grafana_datasource_enabled = true
  grafana_namespace          = "monitoring"

  sampling_rate     = var.tracing_sampling_rate
  batch_span_count  = 200
  batch_flush_delay = 3

  depends_on = [module.monitoring, module.eks]
}

# MongoDB - User Service
module "mongodb_user_service" {
  source = "../../modules/platform/mongodb_sharded"
  count  = var.mongodb_enabled ? 1 : 0

  namespace    = "mongodb-user"
  release_name = "user-mongodb"

  mongodb_root_username   = "root"
  mongodb_root_password   = var.mongodb_root_password
  mongodb_replica_set_key = var.mongodb_replica_set_key

  # EKS: slightly larger cluster for reliability
  mongodb_shards                  = 1
  mongodb_configsvr_replica_count = 3
  mongodb_shardsvr_replica_count  = 2
  mongodb_mongos_replica_count    = 2

  mongodb_configsvr_persistence_size = "5Gi"
  mongodb_shardsvr_persistence_size  = "20Gi"

  kubernetes_primary_node_pool_name = "platform"

  depends_on = [module.eks]
}

# MongoDB - Task Service
module "mongodb_task_service" {
  source = "../../modules/platform/mongodb_sharded"
  count  = var.mongodb_enabled ? 1 : 0

  namespace    = "mongodb-task"
  release_name = "task-mongodb"

  mongodb_root_username   = "root"
  mongodb_root_password   = var.mongodb_root_password
  mongodb_replica_set_key = var.mongodb_replica_set_key

  mongodb_shards                  = 1
  mongodb_configsvr_replica_count = 3
  mongodb_shardsvr_replica_count  = 2
  mongodb_mongos_replica_count    = 2

  mongodb_configsvr_persistence_size = "5Gi"
  mongodb_shardsvr_persistence_size  = "20Gi"

  kubernetes_primary_node_pool_name = "platform"

  depends_on = [module.eks]
}

# Kafka
module "kafka" {
  source = "../../modules/platform/kafka"
  count  = var.kafka_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "kafka"
  create_namespace = true

  release_name  = "kafka"
  chart_version = "31.0.0"

  sasl_user     = "kafka-user"
  sasl_password = var.kafka_sasl_password

  # EKS: 3 controllers for HA
  controller_replica_count = 3
  controller_resources = {
    requests = { cpu = "500m", memory = "2Gi" }
    limits   = { cpu = "1000m", memory = "4Gi" }
  }
  controller_persistence_size     = "10Gi"
  controller_log_persistence_size = "5Gi"

  broker_replica_count = 0 # KRaft mode

  persistence_enabled = true
  storage_class       = "gp3"

  volume_permissions_enabled = false # Not needed on EKS with gp3

  kafka_ui_enabled = true
  kafka_ui_image   = "provectuslabs/kafka-ui:latest"
  kafka_ui_resources = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { cpu = "300m", memory = "512Mi" }
  }

  service_type = "ClusterIP"
  is_minikube  = false

  depends_on = [module.eks]
}

# Redis Cluster
module "redis" {
  source = "../../modules/platform/redis"
  count  = var.redis_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "redis"
  create_namespace = true

  release_name  = "redis-cluster"
  chart_version = "11.0.7"

  redis_password = var.redis_password

  redis_nodes    = 6
  redis_replicas = 1

  redis_resources = {
    requests = { cpu = "200m", memory = "512Mi" }
    limits   = { cpu = "500m", memory = "1Gi" }
  }

  persistence_enabled = true
  persistence_size    = "5Gi"
  storage_class       = "gp3"

  is_minikube      = false
  maxmemory_policy = "allkeys-lru"
  enable_metrics   = true

  enable_redis_commander = false

  depends_on = [module.eks]
}

# BFF Service
module "bff_service" {
  source = "../../modules/platform/bff"
  count  = var.bff_enabled ? 1 : 0

  environment      = var.environment
  namespace        = "dev"
  create_namespace = true
  release_name     = "bff-service"

  image_repository  = module.ecr.repository_urls["bff-service"]
  image_tag         = "latest"
  image_pull_policy = "Always"

  replica_count = 2

  user_service_url = "user-service.dev.svc.cluster.local:50051"
  task_service_url = "task-service.dev.svc.cluster.local:50052"

  redis_host     = "redis-cluster.redis.svc.cluster.local"
  redis_port     = 6379
  redis_password = var.redis_password

  auth_mode  = "kong"
  jwt_secret = var.bff_jwt_secret

  graphql_playground    = false
  graphql_introspection = false
  graphql_debug         = false

  rate_limit_config = {
    user_limit  = 100
    user_window = 60
    ip_limit    = 50
    ip_window   = 60
  }

  resources = {
    requests = { cpu = "200m", memory = "256Mi" }
    limits   = { cpu = "500m", memory = "512Mi" }
  }

  cors_origins = var.cors_origins

  ingress_enabled = false
  ingress_class   = "nginx"
  ingress_host    = var.domain_name

  istio_enabled   = var.istio_enabled
  istio_mtls_mode = "STRICT"

  metrics_enabled = true
  service_monitor_labels = {
    release = "monitoring"
  }

  depends_on = [module.redis, module.eks]
}
