# =============================================================================
# Dev Environment - Core Infrastructure (Phase 1)
# =============================================================================
# This file creates: ECR + VPC + EKS Cluster + Node Groups
# Platform services (MongoDB, Kafka, Redis, etc.) are deployed via Helm
# after EKS is ready.
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
