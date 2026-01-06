# Quick Setup Guide

## 🚀 Deploy Jenkins trong 3 phút

### Prerequisites

```bash
# Check requirements
minikube version    # >= 1.30
terraform --version # >= 1.0
kubectl version     # >= 1.28
make --version      # Any version
```

### Step 1: Start Minikube

```bash
minikube start --cpus=4 --memory=8192 --disk-size=20g
```

### Step 2: Setup Secrets

```bash
cd terraform/environments/minikube

# Create secrets file
make setup-secrets

# Edit và set password
nano secrets.auto.tfvars
```

**Set trong `secrets.auto.tfvars`:**
```hcl
jenkins_user     = "admin"
jenkins_password = "YourSecurePassword123!"  # CHANGE THIS!
```

### Step 3: Verify

```bash
# Check secrets are configured
make check-secrets

# Verify không commit secrets
git status
# secrets.auto.tfvars should NOT appear!
```

### Step 4: Deploy

```bash
# Complete setup
make dev-setup

# Or step by step:
make init
make plan
make apply
```

### Step 5: Access Jenkins

```bash
# Get access info
make access

# Or port forward
make port-forward
# Then open http://localhost:8080

# Or use minikube service
make service
```

### Login

- **URL**: From output above
- **Username**: `admin`
- **Password**: Password bạn đã set trong `secrets.auto.tfvars`

## ✅ Verification

```bash
# Check Jenkins pod
kubectl get pods -n jenkins

# Check Jenkins service
kubectl get svc -n jenkins

# View Jenkins logs
make logs
```

## 📚 Next Steps

1. ✅ Jenkins is running
2. Configure Kubernetes Cloud (optional)
3. Create your first pipeline
4. Setup webhooks for GitHub/GitLab

See [complete documentation](../../../docs/jenkins-setup.md) for more details.

## 🆘 Troubleshooting

### Secrets error

```bash
# If you get secrets error:
make setup-secrets
nano secrets.auto.tfvars
make check-secrets
```

### Pod not starting

```bash
make status
make logs
kubectl describe pod -n jenkins <pod-name>
```

### Can't access UI

```bash
make port-forward
# Access at http://localhost:8080
```

## 🧹 Cleanup

```bash
# Destroy Jenkins
make destroy

# Stop Minikube
minikube stop
```

## 📖 Documentation

- [Secrets Management](./SECRETS_MANAGEMENT.md) - Complete secrets guide
- [Environment README](./README.md) - Full environment documentation
- [Jenkins Setup Guide](../../../docs/jenkins-setup.md) - Comprehensive guide

---

**Remember:** Never commit `secrets.auto.tfvars`! 🔐