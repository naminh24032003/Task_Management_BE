# =============================================================================
# Dev Environment - Default Values
# =============================================================================

environment = "dev"
aws_region  = "ap-southeast-1"

# --- EKS Cluster ---
kubernetes_version = "1.29"

# General nodes (app services) - SPOT for cost savings
general_instance_types = ["t3.medium", "t3a.medium"]
general_capacity_type  = "SPOT"
general_desired_size   = 2
general_min_size       = 1
general_max_size       = 5

# Platform nodes (MongoDB, Kafka, Redis) - ON_DEMAND for stability
enable_platform_nodegroup = true
platform_instance_types   = ["t3.large", "t3a.large"]
platform_desired_size     = 2
platform_min_size         = 2
platform_max_size         = 4

# --- Feature Flags ---
monitoring_enabled = true
logging_enabled    = true
tracing_enabled    = true
mongodb_enabled    = true
kafka_enabled      = true
redis_enabled      = true
bff_enabled        = true
istio_enabled      = false   # start without Istio, enable later

tracing_sampling_rate = 50  # 50% sampling in dev

# --- Domain ---
domain_name  = "api.taskmanagement.dev"
cors_origins = ["https://taskmanagement.dev", "http://localhost:3000"]
