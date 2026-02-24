# =============================================================================
# EKS Managed Node Groups
# =============================================================================

# -----------------------------------------------------------------------------
# IAM Role for Node Groups
# -----------------------------------------------------------------------------
resource "aws_iam_role" "node" {
  name = "${var.cluster_name}-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "node_worker" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.node.name
}

resource "aws_iam_role_policy_attachment" "node_cni" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.node.name
}

resource "aws_iam_role_policy_attachment" "node_ecr" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.node.name
}

resource "aws_iam_role_policy_attachment" "node_ssm" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.node.name
}

# -----------------------------------------------------------------------------
# General Node Group (for application services)
# -----------------------------------------------------------------------------
resource "aws_eks_node_group" "general" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-general"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  instance_types = var.general_instance_types
  capacity_type  = var.general_capacity_type # ON_DEMAND or SPOT

  scaling_config {
    desired_size = var.general_desired_size
    min_size     = var.general_min_size
    max_size     = var.general_max_size
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    role = "general"
  }

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-general"
  })

  depends_on = [
    aws_iam_role_policy_attachment.node_worker,
    aws_iam_role_policy_attachment.node_cni,
    aws_iam_role_policy_attachment.node_ecr,
  ]
}

# -----------------------------------------------------------------------------
# Platform Node Group (for MongoDB, Kafka, Redis - needs more resources)
# -----------------------------------------------------------------------------
resource "aws_eks_node_group" "platform" {
  count = var.enable_platform_nodegroup ? 1 : 0

  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-platform"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  instance_types = var.platform_instance_types
  capacity_type  = "ON_DEMAND" # Platform services need stability

  scaling_config {
    desired_size = var.platform_desired_size
    min_size     = var.platform_min_size
    max_size     = var.platform_max_size
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    role = "platform"
  }

  taint {
    key    = "dedicated"
    value  = "platform"
    effect = "NO_SCHEDULE"
  }

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-platform"
  })

  depends_on = [
    aws_iam_role_policy_attachment.node_worker,
    aws_iam_role_policy_attachment.node_cni,
    aws_iam_role_policy_attachment.node_ecr,
  ]
}
