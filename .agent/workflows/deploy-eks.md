---
description: Hướng dẫn từng bước deploy lên AWS EKS
---

# 🚀 Deploy Task Management lên AWS EKS - Từng bước chi tiết

## Tổng quan

```
Bước 1: Cài đặt tools
Bước 2: Tạo AWS Account + IAM User
Bước 3: Tạo S3 Backend cho Terraform
Bước 4: Tạo ECR repos (Docker registry)
Bước 5: Tạo VPC + EKS Cluster (Terraform)
Bước 6: Configure kubectl
Bước 7: Deploy Platform Services (MongoDB, Kafka, Redis, Monitoring)
Bước 8: Build & Push Docker images lên ECR
Bước 9: Deploy 4 Microservices lên EKS
Bước 10: Deploy Kong Gateway
Bước 11: Verify & Test
```

Thời gian ước tính: **3-5 giờ** (lần đầu)
Chi phí AWS ước tính: **$150-300/tháng** (dev environment)

---

## Bước 1: Cài đặt Tools (nếu chưa có)

### 1.1 AWS CLI
```powershell
# Tải từ: https://aws.amazon.com/cli/
# Hoặc dùng winget:
winget install Amazon.AWSCLI
```

### 1.2 Terraform
```powershell
# Tải từ: https://developer.hashicorp.com/terraform/install
# Hoặc dùng winget:
winget install Hashicorp.Terraform
```

### 1.3 Kiểm tra đã có sẵn
```powershell
# Bạn đã có sẵn các tools này (đang dùng với Minikube):
kubectl version --client
helm version
docker version
```

### 1.4 Verify tất cả
```powershell
aws --version        # >= 2.x
terraform --version  # >= 1.5
kubectl version --client
helm version
docker version
```

---

## Bước 2: Tạo AWS Account + IAM User

### 2.1 Tạo AWS Account
- Vào https://aws.amazon.com → Create Account
- Cần credit card (có free tier 12 tháng)

### 2.2 Tạo IAM User cho Terraform
```
AWS Console → IAM → Users → Create User
  - Username: terraform-admin
  - Attach policies:
    ✅ AmazonEKSClusterPolicy
    ✅ AmazonEKSWorkerNodePolicy  
    ✅ AmazonVPCFullAccess
    ✅ AmazonEC2FullAccess
    ✅ AmazonS3FullAccess
    ✅ AmazonDynamoDBFullAccess
    ✅ AmazonECRFullAccess
    ✅ IAMFullAccess
    (hoặc đơn giản hơn: AdministratorAccess cho dev)
  - Create Access Key → Download CSV
```

### 2.3 Configure AWS CLI
```powershell
aws configure
# AWS Access Key ID:     <từ CSV>
# AWS Secret Access Key: <từ CSV>
# Default region name:   ap-southeast-1    (Singapore, gần VN nhất)
# Default output format: json
```

### 2.4 Verify
```powershell
aws sts get-caller-identity
# Phải trả về AccountId, Arn, UserId
```

---

## Bước 3: Tạo S3 Backend cho Terraform State

### 3.1 Tạo S3 Bucket
```powershell
aws s3 mb s3://task-management-terraform-state --region ap-southeast-1

# Bật versioning (bảo vệ state file)
aws s3api put-bucket-versioning `
  --bucket task-management-terraform-state `
  --versioning-configuration Status=Enabled
```

### 3.2 Tạo DynamoDB Table (state locking)
```powershell
aws dynamodb create-table `
  --table-name task-management-terraform-locks `
  --attribute-definitions AttributeName=LockID,AttributeType=S `
  --key-schema AttributeName=LockID,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --region ap-southeast-1
```

### 3.3 Verify
```powershell
aws s3 ls | Select-String "task-management"
aws dynamodb describe-table --table-name task-management-terraform-locks --query "Table.TableStatus"
```

---

## Bước 4: Tạo ECR Repos (Docker Image Registry)

### 4.1 Tạo 4 repos cho 4 services
```powershell
$services = @("user-service", "task-service", "notification-service", "bff-service")
$region = "ap-southeast-1"

foreach ($svc in $services) {
  aws ecr create-repository `
    --repository-name "task-management/$svc" `
    --region $region `
    --image-scanning-configuration scanOnPush=true
  Write-Host "✅ Created repo: task-management/$svc"
}
```

### 4.2 Lấy ECR Registry URL
```powershell
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$ECR_REGISTRY = "$ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com"
Write-Host "ECR Registry: $ECR_REGISTRY"
# Ghi nhớ URL này, sẽ dùng ở các bước sau
```

### 4.3 Login ECR
```powershell
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
```

---

## Bước 5: Tạo VPC + EKS Cluster (Terraform)

### 5.1 Tạo secrets file
```powershell
# Copy template
Copy-Item `
  terraform\environments\dev\secrets.auto.tfvars.example `
  terraform\environments\dev\secrets.auto.tfvars

# Sửa file secrets.auto.tfvars với giá trị thật:
```

Nội dung `secrets.auto.tfvars`:
```hcl
mongodb_root_password   = "MongoDB@Root2024Secure!"   # Dùng password mạnh hơn cho prod
mongodb_replica_set_key = "your-replica-set-key-here"
kafka_sasl_password     = "Kafka@SASL2024Secure!"
redis_password          = "Redis@Cluster2024Secure!"
grafana_admin_password  = "GrafanaAdmin2024!"
bff_jwt_secret          = "your-super-secret-jwt-key-at-least-32-characters-long"
```

### 5.2 Terraform Init
```powershell
cd terraform\environments\dev
terraform init
```
> ⏱️ Mất ~1 phút. Download providers (aws, helm, kubernetes)

### 5.3 Terraform Plan (xem trước sẽ tạo gì)
```powershell
terraform plan -out=tfplan
```
> Sẽ hiện danh sách ~30-50 resources sẽ tạo (VPC, Subnets, EKS, Node Groups...)
> **Đọc kỹ plan trước khi apply!**

### 5.4 Terraform Apply (tạo thật)
```powershell
terraform apply tfplan
```
> ⏱️ **Mất 15-25 phút** (EKS cluster tạo lâu nhất ~10-15 phút)
> 
> Thứ tự tạo:
> 1. VPC + Subnets + NAT Gateway (~3 phút)
> 2. EKS Cluster (~10-15 phút)  
> 3. Node Groups (~5 phút)
> 4. EKS Add-ons (~2 phút)

### 5.5 Lưu outputs
```powershell
terraform output
# Ghi nhớ: cluster_name, cluster_endpoint, configure_kubectl command
```

---

## Bước 6: Configure kubectl cho EKS

### 6.1 Update kubeconfig
```powershell
# Dùng command từ terraform output:
aws eks update-kubeconfig --region ap-southeast-1 --name task-management-dev
```

### 6.2 Verify kết nối
```powershell
kubectl get nodes
# Phải thấy 2-4 nodes (general + platform node groups)
# STATUS phải là "Ready"

kubectl get ns
# Phải thấy default, kube-system, kube-public
```

### 6.3 Tạo namespace cho services
```powershell
kubectl create namespace dev
kubectl create namespace kong
```

---

## Bước 7: Deploy Platform Services

> **Quan trọng**: Deploy platform trước, services sau.
> Thứ tự: Storage Class → MongoDB → Redis → Kafka → Monitoring → Tracing

### 7.1 Tạo StorageClass gp3 (EBS)
```powershell
kubectl apply -f - @"
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
"@
```

### 7.2 Option A: Deploy platform qua Terraform (đã có trong main.tf)
```powershell
# Nếu Bước 5 đã apply thành công, platform services đã được deploy
# Kiểm tra:
kubectl get pods -n kafka
kubectl get pods -n redis
kubectl get pods -n mongodb-user
kubectl get pods -n mongodb-task
kubectl get pods -n monitoring
kubectl get pods -n tracing
```

### 7.3 Option B: Deploy platform thủ công bằng Helm (nếu Terraform gặp lỗi)
```powershell
# MongoDB User Service
cd terraform\environments\minikube
# Sử dụng lại Makefile minikube nhưng thay đổi values cho EKS

# Hoặc chạy trực tiếp Helm:
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Redis Cluster
helm install redis-cluster bitnami/redis-cluster `
  --namespace redis --create-namespace `
  --set password="Redis@Cluster2024Secure!" `
  --set cluster.nodes=6 `
  --set persistence.size=5Gi `
  --set persistence.storageClass=gp3

# Kafka
helm install kafka bitnami/kafka `
  --namespace kafka --create-namespace `
  --set sasl.client.users[0]="kafka-user" `
  --set sasl.client.passwords[0]="Kafka@SASL2024Secure!" `
  --set controller.replicaCount=3 `
  --set persistence.size=10Gi `
  --set persistence.storageClass=gp3

# MongoDB (user-service)
helm install user-mongodb bitnami/mongodb-sharded `
  --namespace mongodb-user --create-namespace `
  --set auth.rootPassword="MongoDB@Root2024Secure!" `
  --set shards=1 `
  --set configsvr.replicaCount=3 `
  --set shardsvr.dataNode.replicaCount=2 `
  --set mongos.replicaCount=2 `
  --set persistence.storageClass=gp3

# MongoDB (task-service)  
helm install task-mongodb bitnami/mongodb-sharded `
  --namespace mongodb-task --create-namespace `
  --set auth.rootPassword="MongoDB@Root2024Secure!" `
  --set shards=1 `
  --set configsvr.replicaCount=3 `
  --set shardsvr.dataNode.replicaCount=2 `
  --set mongos.replicaCount=2 `
  --set persistence.storageClass=gp3
```

### 7.4 Đợi platform services ready
```powershell
# Đợi tất cả pods running (mất 5-10 phút)
kubectl get pods -A -w
# Ctrl+C khi tất cả STATUS = Running/Ready
```

---

## Bước 8: Build & Push Docker Images lên ECR

### 8.1 Login ECR (nếu chưa)
```powershell
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$ECR_REGISTRY = "$ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com"
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
```

### 8.2 Build & Push từng service

#### User Service (Node.js - build context = service folder)
```powershell
docker build -t "$ECR_REGISTRY/task-management/user-service:v1" `
  -f service/user-service/Dockerfile `
  service/user-service/

docker push "$ECR_REGISTRY/task-management/user-service:v1"
```

#### Task Service (Go - build context = project root vì dùng shared module)
```powershell
docker build -t "$ECR_REGISTRY/task-management/task-service:v1" `
  -f service/task-service/Dockerfile .

docker push "$ECR_REGISTRY/task-management/task-service:v1"
```

#### Notification Service (Go - build context = project root)
```powershell
docker build -t "$ECR_REGISTRY/task-management/notification-service:v1" `
  -f service/notification-service/Dockerfile .

docker push "$ECR_REGISTRY/task-management/notification-service:v1"
```

#### BFF Service (Node.js - build context = service folder)
```powershell
docker build -t "$ECR_REGISTRY/task-management/bff-service:v1" `
  -f service/bff-service/Dockerfile `
  service/bff-service/

docker push "$ECR_REGISTRY/task-management/bff-service:v1"
```

### 8.3 Verify images đã push
```powershell
foreach ($svc in @("user-service","task-service","notification-service","bff-service")) {
  Write-Host "=== $svc ==="
  aws ecr describe-images --repository-name "task-management/$svc" --query 'imageDetails[*].imageTags' --output text
}
```

---

## Bước 9: Deploy 4 Microservices lên EKS

### 9.1 Tạo Kubernetes Secrets (cho mỗi service)
```powershell
# User Service secrets
kubectl create secret generic user-service-secrets `
  --namespace dev `
  --from-literal=MONGODB_URI="mongodb://root:MongoDB%40Root2024Secure%21@user-mongodb-mongodb-sharded.mongodb-user.svc.cluster.local:27017/userservice?authSource=admin" `
  --from-literal=JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long" `
  --from-literal=REDIS_PASSWORD="Redis@Cluster2024Secure!" `
  --from-literal=KAFKA_PASSWORD="Kafka@SASL2024Secure!" `
  --from-literal=GOOGLE_CLIENT_ID="" `
  --from-literal=GOOGLE_CLIENT_SECRET=""

# BFF Service secrets  
kubectl create secret generic bff-service-secrets `
  --namespace dev `
  --from-literal=JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long" `
  --from-literal=REDIS_PASSWORD="Redis@Cluster2024Secure!"
```

### 9.2 Deploy từng service bằng Helm

```powershell
$ECR_REGISTRY = "<YOUR_ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com"
$TAG = "v1"

# User Service
helm upgrade --install user-service charts/microservice `
  --namespace dev `
  --values apps/user-service/values-eks.yaml `
  --set microservice.image.repository="$ECR_REGISTRY/task-management/user-service" `
  --set microservice.image.tag="$TAG" `
  --timeout 5m --wait

# Task Service
helm upgrade --install task-service charts/microservice `
  --namespace dev `
  --values apps/task-service/values-eks.yaml `
  --set microservice.image.repository="$ECR_REGISTRY/task-management/task-service" `
  --set microservice.image.tag="$TAG" `
  --timeout 5m --wait

# Notification Service
helm upgrade --install notification-service charts/microservice `
  --namespace dev `
  --values apps/notification-service/values-eks.yaml `
  --set microservice.image.repository="$ECR_REGISTRY/task-management/notification-service" `
  --set microservice.image.tag="$TAG" `
  --timeout 5m --wait

# BFF Service (deploy cuối vì phụ thuộc user + task service)
helm upgrade --install bff-service charts/microservice `
  --namespace dev `
  --values apps/bff-service/values-eks.yaml `
  --set microservice.image.repository="$ECR_REGISTRY/task-management/bff-service" `
  --set microservice.image.tag="$TAG" `
  --timeout 5m --wait
```

### 9.3 Verify deployments
```powershell
kubectl get deployments -n dev
kubectl get pods -n dev
kubectl get svc -n dev
```

---

## Bước 10: Deploy Kong Gateway

### 10.1 Install Kong
```powershell
helm repo add kong https://charts.konghq.com
helm repo update

helm install kong kong/kong `
  --namespace kong `
  --set proxy.type=LoadBalancer `
  --set ingressController.installCRDs=false `
  --set admin.enabled=true `
  --set admin.type=ClusterIP
```

### 10.2 Lấy External IP (LoadBalancer)
```powershell
kubectl get svc kong-kong-proxy -n kong
# EXTERNAL-IP sẽ là AWS NLB/ELB URL
# Ví dụ: a1b2c3d4-1234567890.ap-southeast-1.elb.amazonaws.com
```
> ⏱️ Đợi 2-3 phút để AWS tạo Load Balancer

### 10.3 Cấu hình Kong Routes (giống Minikube)
```powershell
# Tạo Kong Service + Route cho BFF
kubectl apply -f - @"
apiVersion: configuration.konghq.com/v1
kind: KongIngress
metadata:
  name: bff-route
  namespace: dev
route:
  paths:
    - /graphql
  strip_path: false
"@
```

---

## Bước 11: Verify & Test

### 11.1 Kiểm tra tất cả pods
```powershell
kubectl get pods -A | Select-String -Pattern "dev|kafka|redis|mongodb|monitoring|kong|tracing"
```

### 11.2 Test API qua Kong LoadBalancer
```powershell
$KONG_URL = kubectl get svc kong-kong-proxy -n kong -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Health check
curl "http://$KONG_URL/health"

# GraphQL test (nếu Kong routes đã cấu hình)
curl -X POST "http://$KONG_URL/graphql" `
  -H "Content-Type: application/json" `
  -d '{"query":"{ __typename }"}'
```

### 11.3 Xem logs nếu gặp lỗi
```powershell
# Xem logs service cụ thể
kubectl logs -n dev -l app.kubernetes.io/name=user-service --tail=50
kubectl logs -n dev -l app.kubernetes.io/name=task-service --tail=50
kubectl logs -n dev -l app.kubernetes.io/name=notification-service --tail=50
kubectl logs -n dev -l app.kubernetes.io/name=bff-service --tail=50

# Xem events nếu pod không start
kubectl get events -n dev --sort-by='.lastTimestamp'
```

### 11.4 Port-forward để debug (nếu cần)
```powershell
# Grafana
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80

# BFF trực tiếp (bypass Kong)
kubectl port-forward svc/bff-service -n dev 4000:4000
```

---

## ⚠️ Troubleshooting thường gặp

### Pod ở trạng thái Pending
```powershell
kubectl describe pod <pod-name> -n <namespace>
# Thường do: không đủ resources trên nodes
# Fix: tăng node group size trong terraform.tfvars
```

### Pod ở trạng thái CrashLoopBackOff
```powershell
kubectl logs <pod-name> -n <namespace> --previous
# Thường do: sai config, không kết nối được MongoDB/Redis/Kafka
# Fix: kiểm tra lại env vars và service DNS
```

### EBS volumes không attach được
```powershell
kubectl get pvc -A
# Nếu PVC ở trạng thái Pending:
# Kiểm tra EBS CSI driver đã cài chưa
kubectl get pods -n kube-system | Select-String "ebs"
```

### Image pull error
```powershell
# Kiểm tra ECR login đã expired chưa (12 giờ)
# Re-login:
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
```

---

## 💰 Chi phí ước tính (tháng)

| Resource | Specification | Cost/month |
|---|---|---|
| EKS Cluster | Control plane | $73 |
| EC2 (general) | 2× t3.medium Spot | ~$30 |
| EC2 (platform) | 2× t3.large ON_DEMAND | ~$120 |
| NAT Gateway | 1× | ~$32 |
| EBS Storage | ~100GB gp3 | ~$10 |
| ECR | 4 repos, ~5GB | ~$1 |
| S3 + DynamoDB | Terraform state | ~$1 |
| **Tổng** | | **~$267/tháng** |

### Tiết kiệm hơn:
- Dùng Spot cho cả platform nodes: giảm ~$60
- Không dùng NAT Gateway (public subnets only): giảm $32
- Tắt cluster ngoài giờ làm việc: giảm 60-70%

---

## 🔄 Cập nhật code sau này

```powershell
# 1. Build image mới
docker build -t "$ECR_REGISTRY/task-management/task-service:v2" -f service/task-service/Dockerfile .
docker push "$ECR_REGISTRY/task-management/task-service:v2"

# 2. Deploy
helm upgrade task-service charts/microservice `
  --namespace dev `
  --values apps/task-service/values-eks.yaml `
  --set microservice.image.repository="$ECR_REGISTRY/task-management/task-service" `
  --set microservice.image.tag="v2" `
  --timeout 5m --wait

# Hoặc push code lên GitHub → CI/CD tự động deploy
```
