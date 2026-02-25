# =============================================================================
# Dev Environment - Default Values (Phase 1)
# =============================================================================

environment = "dev"
aws_region  = "ap-southeast-1"

# --- EKS Cluster ---
kubernetes_version = "1.29"

# General nodes (app services) - ON_DEMAND (Free Tier eligible)
general_instance_types = ["t3.small"]
general_capacity_type  = "ON_DEMAND"
general_desired_size   = 2
general_min_size       = 1
general_max_size       = 3

# Platform nodes (MongoDB, Kafka, Redis) - ON_DEMAND (Free Tier eligible)
enable_platform_nodegroup = true
platform_instance_types   = ["m7i-flex.large"]
platform_desired_size     = 1
platform_min_size         = 1
platform_max_size         = 2
