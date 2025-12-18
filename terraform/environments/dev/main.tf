# Development Environment
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "dev"
      Project     = "task-management"
      ManagedBy   = "terraform"
    }
  }
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  vpc_name             = "task-mgmt-dev-vpc"
  vpc_cidr             = "10.0.0.0/16"
  availability_zones   = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
  enable_nat_gateway   = true
  cluster_name         = var.cluster_name

  tags = {
    Environment = "dev"
  }
}

# EKS Cluster Module
module "eks" {
  source = "../../modules/eks-cluster"

  cluster_name        = var.cluster_name
  kubernetes_version  = "1.28"
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = concat(module.vpc.public_subnet_ids, module.vpc.private_subnet_ids)
  
  desired_size = 2
  max_size     = 5
  min_size     = 1
  
  instance_types = ["t3.medium"]
  disk_size      = 20

  tags = {
    Environment = "dev"
  }

  depends_on = [module.vpc]
}

# RDS PostgreSQL Module
module "rds" {
  source = "../../modules/rds-postgres"

  identifier          = "task-mgmt-dev-db"
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  allowed_cidr_blocks = ["10.0.0.0/16"]

  engine_version      = "15.4"
  instance_class      = "db.t3.micro"
  allocated_storage   = 20
  max_allocated_storage = 50

  database_name   = var.database_name
  master_username = var.db_username
  master_password = var.db_password

  multi_az                    = false
  backup_retention_period     = 3
  performance_insights_enabled = false
  deletion_protection         = false
  skip_final_snapshot        = true

  tags = {
    Environment = "dev"
  }

  depends_on = [module.vpc]
}

# S3 Buckets Module
module "s3" {
  source = "../../modules/s3-buckets"

  buckets = {
    terraform_state = {
      name                = "task-mgmt-dev-terraform-state"
      versioning_enabled  = true
      force_destroy       = false
      tags                = { Purpose = "terraform-state" }
      lifecycle_rules     = null
    }
    
    uploads = {
      name                = "task-mgmt-dev-uploads"
      versioning_enabled  = false
      force_destroy       = true
      tags                = { Purpose = "user-uploads" }
      lifecycle_rules = [{
        id              = "delete-old-files"
        enabled         = true
        expiration_days = 90
        transitions     = null
      }]
    }
    
    backups = {
      name                = "task-mgmt-dev-backups"
      versioning_enabled  = true
      force_destroy       = false
      tags                = { Purpose = "backups" }
      lifecycle_rules = [{
        id              = "archive-old-backups"
        enabled         = true
        expiration_days = null
        transitions = [{
          days          = 30
          storage_class = "GLACIER"
        }]
      }]
    }
  }

  tags = {
    Environment = "dev"
  }
}
