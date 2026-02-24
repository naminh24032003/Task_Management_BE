# =============================================================================
# Dev Environment - Outputs
# =============================================================================

# --- EKS ---
output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API endpoint"
  value       = module.eks.cluster_endpoint
}

output "configure_kubectl" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

# --- ECR ---
output "ecr_repository_urls" {
  description = "ECR repository URLs for each service"
  value       = module.ecr.repository_urls
}

output "ecr_login_command" {
  description = "Command to login to ECR"
  value       = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${module.ecr.registry_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

# --- Network ---
output "vpc_id" {
  description = "VPC ID"
  value       = module.network.vpc_id
}
