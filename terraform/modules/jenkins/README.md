# Jenkins Terraform Module

This module deploys Jenkins on Kubernetes using the Bitnami Helm chart with custom configurations for CI/CD pipelines.

## Features

- **Bitnami Jenkins Helm Chart**: Uses the official Bitnami Jenkins chart
- **Kubernetes Agents**: Supports dynamic Kubernetes-based build agents
- **RBAC Configuration**: Pre-configured service account and roles for deployments
- **Persistence**: Optional persistent storage for Jenkins data
- **Ingress Support**: Optional ingress configuration
- **Init Scripts**: Support for custom Groovy init scripts
- **Flexible Resources**: Configurable resource requests and limits

## Usage

### Basic Example (Minikube)

```hcl
module "jenkins" {
  source = "../../modules/jenkins"

  namespace   = "jenkins"
  environment = "dev"

  # Authentication
  jenkins_user     = "admin"
  jenkins_password = "your-secure-password"

  # Resources (suitable for Minikube)
  resources = {
    requests = {
      cpu    = "250m"
      memory = "256Mi"
    }
    limits = {
      cpu    = "1000m"
      memory = "1024Mi"
    }
  }

  # Persistence
  persistence = {
    enabled       = true
    size          = "5Gi"
    storage_class = "standard"  # Minikube default
  }

  # Service
  service_type = "NodePort"  # For easy access in Minikube

  # Ingress (disabled for Minikube)
  ingress = {
    enabled    = false
    hostname   = "jenkins.local"
    class_name = "nginx"
    tls        = false
  }

  # Agents
  agent = {
    enabled       = true
    container_cap = 5
    node_selector = ""
  }
}
```

### Advanced Example (EKS Production)

```hcl
module "jenkins" {
  source = "../../modules/jenkins"

  namespace   = "jenkins"
  environment = "prod"

  # Authentication
  jenkins_user     = "admin"
  jenkins_password = var.jenkins_password  # From AWS Secrets Manager

  # Resources (production-grade)
  resources = {
    requests = {
      cpu    = "1000m"
      memory = "2048Mi"
    }
    limits = {
      cpu    = "4000m"
      memory = "8192Mi"
    }
  }

  # Persistence with EBS
  persistence = {
    enabled       = true
    size          = "50Gi"
    storage_class = "gp3"  # EKS gp3 storage class
  }

  # Service (internal only)
  service_type = "ClusterIP"

  # Ingress with ALB
  ingress = {
    enabled    = true
    hostname   = "jenkins.example.com"
    class_name = "alb"
    tls        = true
  }

  # Agents with node selector
  agent = {
    enabled       = true
    container_cap = 20
    node_selector = "workload-type=ci-cd"
  }

  # Custom init scripts
  enable_init_scripts = true
  init_groovy_scripts = {
    "setup-kubernetes-cloud.groovy" = file("${path.module}/scripts/setup-kubernetes-cloud.groovy")
  }

  deployment_namespace = "default"  # Namespace where apps are deployed
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| namespace | Kubernetes namespace for Jenkins | string | "jenkins" | no |
| environment | Environment name (dev, staging, prod) | string | "dev" | no |
| release_name | Helm release name | string | "jenkins" | no |
| chart_version | Jenkins Helm chart version | string | "13.4.18" | no |
| jenkins_user | Jenkins admin username | string | "admin" | no |
| jenkins_password | Jenkins admin password | string | - | **yes** |
| resources | Resource requests and limits | object | See variables.tf | no |
| persistence | Persistence configuration | object | See variables.tf | no |
| ingress | Ingress configuration | object | See variables.tf | no |
| service_type | Service type (ClusterIP, NodePort, LoadBalancer) | string | "ClusterIP" | no |
| agent | Agent configuration | object | See variables.tf | no |
| enable_init_scripts | Enable init groovy scripts | bool | false | no |
| init_groovy_scripts | Map of groovy scripts | map(string) | {} | no |
| deployment_namespace | Namespace for app deployments | string | "" | no |

## Outputs

| Name | Description |
|------|-------------|
| namespace | Jenkins namespace |
| release_name | Helm release name |
| release_status | Helm release status |
| jenkins_service_name | Jenkins service name |
| jenkins_service_port | Jenkins HTTP port |
| jenkins_agent_service_account | Agent service account |
| jenkins_url | Internal cluster URL |
| jenkins_external_url | External URL (if ingress enabled) |

## Accessing Jenkins

### Minikube

```bash
# Get the NodePort
kubectl get svc -n jenkins jenkins -o jsonpath='{.spec.ports[0].nodePort}'

# Get Minikube IP
minikube ip

# Access Jenkins at http://<minikube-ip>:<node-port>
```

### EKS with Ingress

Access via the configured hostname (e.g., https://jenkins.example.com)

### Port Forward (any cluster)

```bash
kubectl port-forward -n jenkins svc/jenkins 8080:80
# Access at http://localhost:8080
```

## Init Scripts

You can provide custom Groovy init scripts for Jenkins configuration:

```hcl
init_groovy_scripts = {
  "setup-credentials.groovy" = templatefile("${path.module}/scripts/setup-credentials.groovy", {
    docker_registry = var.docker_registry
    docker_username = var.docker_username
    docker_password = var.docker_password
  })
}
```

## Requirements

- Kubernetes cluster (Minikube, EKS, GKE, AKS, etc.)
- Terraform >= 1.0
- Helm >= 3.0
- kubectl configured

## License

MIT