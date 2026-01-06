# Jenkins + ArgoCD trên Minikube - Hướng dẫn truy cập

## ✅ Tình trạng triển khai

**Jenkins và ArgoCD đã được triển khai thành công trên Minikube!**

- ✅ Jenkins: Running (2/2 containers ready)
- ✅ ArgoCD: Running (7 pods ready)
- ✅ Minikube IP: `192.168.49.2`

---

## 🚀 Truy cập Jenkins

### Thông tin kết nối:
- **URL**: http://192.168.49.2:32243
- **Username**: `admin`
- **Password**: `Jenkins@2024Secure!`

### Lệnh kiểm tra:
```bash
# Kiểm tra Jenkins pods
kubectl get pods -n jenkins

# Kiểm tra Jenkins service
kubectl get svc -n jenkins

# Xem logs Jenkins
kubectl logs -n jenkins jenkins-0 -c jenkins
```

### Port Forwarding (Alternative):
```bash
kubectl port-forward -n jenkins svc/jenkins 8080:8080
# Truy cập: http://localhost:8080
```

---

## 🎯 Truy cập ArgoCD

### Thông tin kết nối:
- **URL**: http://192.168.49.2:32583
- **Username**: `admin`
- **Password**: `7v6XQQvEEfI3YwJW`

### Lệnh lấy password (nếu cần):
```bash
kubectl get secret -n argocd argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### ArgoCD CLI Login:
```bash
# Install ArgoCD CLI (nếu chưa có)
# Windows: choco install argocd-cli
# Mac: brew install argocd
# Linux: curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64

# Login
argocd login 192.168.49.2:32583 --username admin --password 7v6XQQvEEfI3YwJW --insecure

# List applications
argocd app list
```

### Port Forwarding (Alternative):
```bash
kubectl port-forward -n argocd svc/argocd-server 8080:80
# Truy cập: http://localhost:8080
```

---

## 📊 Monitoring

### Kiểm tra tất cả resources:
```bash
# Jenkins namespace
kubectl get all -n jenkins

# ArgoCD namespace
kubectl get all -n argocd
```

### Kiểm tra logs:
```bash
# Jenkins logs
kubectl logs -n jenkins jenkins-0 -c jenkins -f

# ArgoCD server logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-server -f

# ArgoCD application controller logs
kubectl logs -n argocd argocd-application-controller-0 -f
```

---

## 🔧 Cấu hình Jenkins cho Kubernetes

Jenkins đã được cài đặt với **Kubernetes plugin**, cho phép:
- Tự động tạo Jenkins agents trong Kubernetes
- Dynamic scaling của build agents
- Isolation giữa các builds

### Cấu hình Kubernetes Cloud trong Jenkins:
1. Vào Jenkins UI → Manage Jenkins → Clouds
2. Đã được pre-configured với:
   - Kubernetes URL: `https://kubernetes.default`
   - Namespace: `jenkins`
   - Jenkins URL: `http://jenkins.jenkins.svc.cluster.local:8080`

---

## 🔄 Jenkins + ArgoCD Integration Workflow

### Quy trình CI/CD đề xuất:

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   GitHub    │─────▶│   Jenkins   │─────▶│   ArgoCD    │
│   (Code)    │      │  (Build/    │      │  (Deploy)   │
│             │      │   Test)     │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ▼
                      ┌─────────────┐
                      │   Docker    │
                      │   Registry  │
                      └─────────────┘
```

### Các bước setup:
1. **Jenkins**: Build code, run tests, build Docker image, push to registry
2. **Jenkins**: Update Kubernetes manifests (image tag) trong Git repo
3. **ArgoCD**: Detect changes trong Git, auto-sync và deploy lên Kubernetes

---

## 📝 Các bước tiếp theo

### 1. Tạo Sample Application
- Tạo một simple NodeJS/Python app
- Tạo Dockerfile
- Tạo Kubernetes manifests

### 2. Configure Jenkins Pipeline
- Tạo Jenkinsfile
- Configure GitHub webhook
- Setup Docker registry credentials

### 3. Configure ArgoCD Application
- Connect Git repository
- Create ArgoCD Application
- Configure auto-sync

### 4. Test CI/CD Flow
- Push code change
- Jenkins tự động build
- ArgoCD tự động deploy

---

## 🚢 Migration lên AWS EKS

### Những thay đổi cần thiết khi chuyển sang EKS:

#### 1. **Service Type**
```yaml
# Minikube: NodePort
service:
  type: NodePort

# EKS: LoadBalancer hoặc Ingress
service:
  type: LoadBalancer
# hoặc sử dụng AWS Load Balancer Controller với Ingress
```

#### 2. **Storage Class**
```yaml
# Minikube: standard (hostPath)
storageClass: standard

# EKS: gp3 (AWS EBS)
storageClass: gp3
```

#### 3. **Ingress Controller**
```bash
# EKS: Cần cài AWS Load Balancer Controller
helm install aws-load-balancer-controller \
  eks/aws-load-balancer-controller \
  -n kube-system
```

#### 4. **DNS và Certificates**
- Minikube: Sử dụng IP:Port
- EKS: Sử dụng Route53 cho DNS + ACM cho SSL/TLS

#### 5. **IAM Roles cho Service Accounts**
```yaml
# EKS: Sử dụng IRSA (IAM Roles for Service Accounts)
serviceAccount:
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/role-name
```

#### 6. **Monitoring & Logging**
- Minikube: kubectl logs
- EKS: Amazon CloudWatch Container Insights

#### 7. **Security**
```yaml
# EKS: Enable security features
podSecurityPolicy:
  enabled: true

networkPolicy:
  enabled: true
```

### Terraform Configuration đã ready cho EKS:
Các Terraform modules trong `terraform/modules/` đã được thiết kế để:
- ✅ Hỗ trợ cả Minikube và EKS
- ✅ Variables cho environment-specific configs
- ✅ Conditional logic cho EKS-specific resources
- ✅ IAM, KMS, VPC modules sẵn sàng cho production

---

## 🔐 Security Best Practices

### Hiện tại (Minikube):
- ❌ HTTP (không SSL/TLS)
- ❌ Passwords hardcoded trong Helm values
- ❌ No authentication webhook

### Nên thực hiện cho Production (EKS):
- ✅ HTTPS với SSL/TLS certificates
- ✅ External secrets management (AWS Secrets Manager)
- ✅ SSO/OAuth integration (GitHub, Google, LDAP)
- ✅ Network policies
- ✅ Pod security policies
- ✅ RBAC cho fine-grained permissions

---

## 📚 Tài liệu tham khảo

- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Jenkins Kubernetes Plugin](https://plugins.jenkins.io/kubernetes/)
- [ArgoCD GitOps Guide](https://argo-cd.readthedocs.io/en/stable/user-guide/)

---

## 🛠️ Troubleshooting

### Jenkins không truy cập được:
```bash
kubectl describe pod jenkins-0 -n jenkins
kubectl logs jenkins-0 -n jenkins -c jenkins
```

### ArgoCD không truy cập được:
```bash
kubectl describe pod -n argocd -l app.kubernetes.io/name=argocd-server
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-server
```

### Minikube issues:
```bash
minikube status
minikube logs
minikube ssh
```

---

**Được tạo tự động bởi Claude Code** 🤖
**Ngày tạo**: 2026-01-06
