# =============================================================================
# Kafka Connect Module - Terraform Version Constraints
# =============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.0"
    }
  }
}
