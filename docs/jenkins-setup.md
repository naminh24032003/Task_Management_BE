# Jenkins Setup Guide

Hướng dẫn chi tiết để setup Jenkins CI/CD trên Kubernetes (Minikube và EKS).

## Mục lục

- [Tổng quan](#tổng-quan)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Setup trên Minikube](#setup-trên-minikube)
- [Setup trên EKS](#setup-trên-eks)
- [Cấu hình Jenkins](#cấu-hình-jenkins)
- [Tạo Pipeline Jobs](#tạo-pipeline-jobs)
- [Troubleshooting](#troubleshooting)

## Tổng quan

Jenkins được deploy sử dụng:
- **Bitnami Jenkins Helm Chart**: Chart chính thức từ Bitnami
- **Terraform Module**: Module tùy chỉnh để quản lý infrastructure
- **Kubernetes Agents**: Dynamic agents chạy trong Kubernetes pods
- **Init Groovy Scripts**: Tự động cấu hình Jenkins khi khởi động

### Kiến trúc

```
┌─────────────────────────────────────────┐
│          Kubernetes Cluster             │
│                                         │
│  ┌────────────────────────────────┐    │
│  │     Jenkins Namespace          │    │
│  │                                │    │
│  │  ┌──────────────────────┐     │    │
│  │  │  Jenkins Master      │     │    │
│  │  │  - UI/API Server     │     │    │
│  │  │  - Job Scheduler     │     │    │
│  │  └──────────────────────┘     │    │
│  │                                │    │
│  │  ┌──────────────────────┐     │    │
│  │  │  Dynamic Agents      │     │    │
│  │  │  - Build Pods        │     │    │
│  │  │  - Deploy Pods       │     │    │
│  │  └──────────────────────┘     │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌────────────────────────────────┐    │
│  │   Application Namespace        │    │
│  │   - Microservices              │    │
│  │   - Deployments                │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## Yêu cầu hệ thống

### Software Requirements

- **Kubernetes Cluster**:
  - Minikube >= 1.30 hoặc
  - EKS >= 1.28
- **Terraform** >= 1.0
- **Helm** >= 3.0
- **kubectl** >= 1.28

### Resource Requirements

#### Minikube (Development)
```bash
minikube start --cpus=4 --memory=8192 --disk-size=20g
```

#### EKS (Production)
- Node group với ít nhất:
  - 2 vCPUs per node
  - 4GB RAM per node
  - 20GB disk space

## Setup trên Minikube

### Bước 1: Khởi động Minikube

```bash
# Start Minikube với đủ resources
minikube start --cpus=4 --memory=8192 --disk-size=20g

# Verify cluster is running
kubectl cluster-info
```

### Bước 2: Cấu hình Terraform Variables

```bash
# Navigate to Minikube environment
cd terraform/environments/minikube

# Copy example tfvars
cp terraform.tfvars.example terraform.tfvars

# Edit với editor của bạn
nano terraform.tfvars
```

Cấu hình `terraform.tfvars`:

```hcl
# Jenkins Authentication
jenkins_user     = "admin"
jenkins_password = "your-secure-password-here"

# Jenkins Init Scripts (optional)
enable_jenkins_init_scripts  = false
jenkins_deployment_namespace = "default"
```

### Bước 3: Deploy Jenkins

```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply deployment
terraform apply

# Confirm with 'yes' when prompted
```

### Bước 4: Access Jenkins

Sau khi deploy thành công, có 2 cách để access Jenkins:

#### Option 1: NodePort (Recommended for Minikube)

```bash
# Get NodePort
export NODE_PORT=$(kubectl get svc -n jenkins jenkins -o jsonpath='{.spec.ports[0].nodePort}')

# Get Minikube IP
export MINIKUBE_IP=$(minikube ip)

# Access URL
echo "Jenkins URL: http://$MINIKUBE_IP:$NODE_PORT"

# Open in browser
minikube service jenkins -n jenkins
```

#### Option 2: Port Forward

```bash
# Forward port 8080
kubectl port-forward -n jenkins svc/jenkins 8080:80

# Access at http://localhost:8080
```

### Bước 5: Login to Jenkins

1. Mở browser và truy cập Jenkins URL
2. Login với credentials:
   - **Username**: `admin` (hoặc giá trị bạn đã set)
   - **Password**: Password bạn đã set trong `terraform.tfvars`

## Setup trên EKS

### Bước 1: Tạo EKS Cluster

```bash
# Sử dụng eksctl hoặc Terraform để tạo EKS cluster
eksctl create cluster \
  --name jenkins-cluster \
  --region us-west-2 \
  --nodegroup-name jenkins-nodes \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4
```

### Bước 2: Tạo Environment cho EKS

```bash
# Tạo thư mục environment
mkdir -p terraform/environments/eks

# Copy từ minikube environment và chỉnh sửa
cp -r terraform/environments/minikube/* terraform/environments/eks/
```

### Bước 3: Update Providers cho EKS

Edit `terraform/environments/eks/providers.tf`:

```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_eks_cluster" "cluster" {
  name = var.eks_cluster_name
}

data "aws_eks_cluster_auth" "cluster" {
  name = var.eks_cluster_name
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.cluster.token
  }
}
```

### Bước 4: Update Jenkins Configuration cho EKS

Edit `terraform/environments/eks/jenkins.tf`:

```hcl
module "jenkins" {
  source = "../../modules/jenkins"

  namespace   = "jenkins"
  environment = "prod"

  jenkins_user     = var.jenkins_user
  jenkins_password = var.jenkins_password

  # Production resources
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

  # Use gp3 storage class for EKS
  persistence = {
    enabled       = true
    size          = "50Gi"
    storage_class = "gp3"
  }

  # Use LoadBalancer for external access
  service_type = "LoadBalancer"

  # Enable ingress with ALB
  ingress = {
    enabled    = true
    hostname   = "jenkins.example.com"
    class_name = "alb"
    tls        = true
  }

  agent = {
    enabled       = true
    container_cap = 20
    node_selector = ""
  }
}
```

### Bước 5: Deploy

```bash
cd terraform/environments/eks
terraform init
terraform plan
terraform apply
```

## Cấu hình Jenkins

### 1. Cài đặt Plugins bổ sung

Mặc định đã có các plugins:
- Kubernetes
- Workflow Aggregator
- GitHub
- Generic Webhook Trigger
- Git
- Docker Workflow

Để cài thêm plugins:

1. Truy cập **Manage Jenkins** → **Manage Plugins**
2. Tab **Available**, search và install:
   - Blue Ocean (nếu muốn UI đẹp hơn)
   - Pipeline AWS Steps (cho EKS)
   - Credentials Binding

### 2. Cấu hình Kubernetes Cloud

#### Manual Configuration

1. **Manage Jenkins** → **Manage Nodes and Clouds** → **Configure Clouds**
2. **Add a new cloud** → **Kubernetes**
3. Cấu hình:
   - **Name**: `kubernetes`
   - **Kubernetes URL**: Leave blank (auto-detect)
   - **Kubernetes Namespace**: `jenkins`
   - **Jenkins URL**: `http://jenkins.jenkins.svc.cluster.local`
   - **Container Cap**: `10` (Minikube) hoặc `20` (EKS)

#### Automated Configuration (Using Init Scripts)

Update `terraform.tfvars`:

```hcl
enable_jenkins_init_scripts = true
```

Tạo file `terraform/environments/minikube/scripts/kubernetes-cloud.groovy`:

```groovy
import jenkins.model.*
import org.csanchez.jenkins.plugins.kubernetes.*

def jenkins = Jenkins.getInstance()
def kubernetesCloud = new KubernetesCloud("kubernetes")

kubernetesCloud.setNamespace("jenkins")
kubernetesCloud.setContainerCapStr("10")
kubernetesCloud.setConnectTimeout(5)
kubernetesCloud.setReadTimeout(15)

jenkins.clouds.add(kubernetesCloud)
jenkins.save()
```

## Tạo Pipeline Jobs

### 1. Basic Kubernetes Deployment Pipeline

```groovy
pipeline {
    agent {
        kubernetes {
            label 'kubernetes-agent'
            defaultContainer 'jnlp'
        }
    }

    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/your-org/your-repo.git'
            }
        }

        stage('Build') {
            steps {
                sh 'echo "Building application..."'
                // Add your build commands
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    kubectl apply -f k8s/deployment.yaml
                    kubectl rollout status deployment/your-app -n default
                '''
            }
        }
    }
}
```

### 2. Webhook-Triggered Pipeline

1. **New Item** → **Pipeline** → Tên: `deployment-rollout`
2. **Build Triggers** → Check **Generic Webhook Trigger**
3. **Token**: `your-secret-token-here`
4. **Pipeline Script**: Paste deployment script

Webhook URL:
```
http://<jenkins-url>/generic-webhook-trigger/invoke?token=your-secret-token-here
```

### 3. Multi-Stage Pipeline với Docker

```groovy
pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: docker
    image: docker:latest
    command:
    - cat
    tty: true
    volumeMounts:
    - name: docker-sock
      mountPath: /var/run/docker.sock
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
            '''
        }
    }

    stages {
        stage('Build Docker Image') {
            steps {
                container('docker') {
                    sh 'docker build -t myapp:latest .'
                }
            }
        }

        stage('Push to Registry') {
            steps {
                container('docker') {
                    sh 'docker push myapp:latest'
                }
            }
        }
    }
}
```

## Troubleshooting

### Jenkins Pod không start

```bash
# Check pod status
kubectl get pods -n jenkins

# Check pod logs
kubectl logs -n jenkins <jenkins-pod-name>

# Check events
kubectl get events -n jenkins --sort-by='.lastTimestamp'
```

**Common issues**:
- **Insufficient resources**: Increase Minikube memory/CPU
- **Storage issue**: Check PVC status
- **Image pull error**: Check internet connection

### Agent pods không được tạo

```bash
# Check Jenkins logs
kubectl logs -n jenkins <jenkins-pod-name> | grep -i agent

# Check RBAC permissions
kubectl auth can-i create pods --as=system:serviceaccount:jenkins:default -n jenkins
```

**Solutions**:
- Verify Kubernetes cloud configuration
- Check service account permissions
- Verify namespace exists

### Cannot access Jenkins UI

**Minikube**:
```bash
# Check service
kubectl get svc -n jenkins

# Use minikube service
minikube service jenkins -n jenkins
```

**EKS**:
```bash
# Check LoadBalancer
kubectl get svc -n jenkins -o wide

# Check ingress
kubectl get ingress -n jenkins
```

### Persistence issues

```bash
# Check PVC
kubectl get pvc -n jenkins

# Check PV
kubectl get pv
```

**Solutions**:
- Ensure storage class exists
- Check disk space
- Verify PVC is bound

## Best Practices

### Security

1. **Always use strong passwords**
2. **Enable RBAC** với least privilege
3. **Use secrets** cho credentials
4. **Enable audit logging**
5. **Regular updates** cho plugins và Jenkins

### Performance

1. **Limit concurrent builds** phù hợp với resources
2. **Use agents** cho builds, không build trên master
3. **Clean up old builds** định kỳ
4. **Monitor resources** usage

### Backup

```bash
# Backup Jenkins home
kubectl exec -n jenkins <jenkins-pod> -- tar czf /tmp/jenkins-backup.tar.gz /bitnami/jenkins/home

# Copy to local
kubectl cp jenkins/<jenkins-pod>:/tmp/jenkins-backup.tar.gz ./jenkins-backup.tar.gz
```

## Migration từ Minikube lên EKS

1. **Backup Jenkins data** từ Minikube
2. **Deploy Jenkins trên EKS** using terraform
3. **Restore data** vào EKS Jenkins
4. **Update webhook URLs** trong GitHub/GitLab
5. **Test pipelines** thoroughly

## Additional Resources

- [Jenkins Official Documentation](https://www.jenkins.io/doc/)
- [Bitnami Jenkins Helm Chart](https://github.com/bitnami/charts/tree/main/bitnami/jenkins)
- [Kubernetes Plugin](https://plugins.jenkins.io/kubernetes/)
- [Pipeline Syntax](https://www.jenkins.io/doc/book/pipeline/syntax/)

## Support

Nếu gặp vấn đề:
1. Check logs: `kubectl logs -n jenkins <pod-name>`
2. Check documentation này
3. Create issue trong project repository