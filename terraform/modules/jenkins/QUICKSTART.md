# Jenkins Quick Start

Hướng dẫn nhanh để deploy Jenkins trong 5 phút.

## Prerequisites

```bash
# Check requirements
terraform --version  # >= 1.0
helm version        # >= 3.0
kubectl version     # >= 1.28

# For Minikube
minikube version    # >= 1.30
```

## Minikube - 5 Phút Setup

### 1. Start Minikube

```bash
minikube start --cpus=4 --memory=8192 --disk-size=20g
```

### 2. Configure & Deploy

```bash
# Navigate to minikube environment
cd terraform/environments/minikube

# Create tfvars from example
cp terraform.tfvars.example terraform.tfvars

# Edit password (IMPORTANT!)
sed -i 's/change-me-to-a-secure-password/MySecurePass123!/' terraform.tfvars

# Deploy
terraform init
terraform apply -auto-approve
```

### 3. Access Jenkins

```bash
# Get access URL
minikube service jenkins -n jenkins

# Or use port-forward
kubectl port-forward -n jenkins svc/jenkins 8080:80
```

### 4. Login

- **URL**: Output từ command trên
- **Username**: `admin`
- **Password**: `MySecurePass123!` (hoặc password bạn đã set)

## Verify Installation

```bash
# Check Jenkins pod
kubectl get pods -n jenkins

# Check Jenkins service
kubectl get svc -n jenkins

# View Jenkins logs
kubectl logs -n jenkins -l app.kubernetes.io/name=jenkins
```

## Next Steps

1. **Cấu hình Kubernetes Cloud**: [See full docs](../../../docs/jenkins-setup.md#cấu-hình-jenkins)
2. **Tạo first pipeline**: [Pipeline examples](../../../docs/jenkins-setup.md#tạo-pipeline-jobs)
3. **Setup webhooks**: [Webhook guide](../../../docs/jenkins-setup.md#webhook-triggered-pipeline)

## Clean Up

```bash
# Destroy Jenkins
terraform destroy -auto-approve

# Stop Minikube
minikube stop
```

## Common Commands

```bash
# Restart Jenkins
kubectl rollout restart deployment -n jenkins

# Scale Jenkins (not recommended, use replicas=1)
kubectl scale deployment jenkins -n jenkins --replicas=1

# Get Jenkins password (if forgotten)
kubectl get secret -n jenkins jenkins -o jsonpath='{.data.jenkins-password}' | base64 -d

# Access Jenkins shell
kubectl exec -it -n jenkins <jenkins-pod-name> -- /bin/bash
```

## Troubleshooting

### Pod CrashLoopBackOff

```bash
kubectl describe pod -n jenkins <pod-name>
kubectl logs -n jenkins <pod-name> --previous
```

### Cannot access UI

```bash
# Check if pod is ready
kubectl get pods -n jenkins

# Check service
kubectl get svc -n jenkins

# Use port-forward as fallback
kubectl port-forward -n jenkins svc/jenkins 8080:80
```

### Storage issues

```bash
# Check PVC
kubectl get pvc -n jenkins

# If pending, check storage class
kubectl get sc

# Minikube uses 'standard' by default
```

## Advanced Configuration

For production deployments, custom plugins, and EKS setup, see:
- [Full Documentation](../../../docs/jenkins-setup.md)
- [Module README](./README.md)

## Support

Issues? Check:
1. [Troubleshooting Guide](../../../docs/jenkins-setup.md#troubleshooting)
2. Pod logs: `kubectl logs -n jenkins <pod-name>`
3. Events: `kubectl get events -n jenkins --sort-by='.lastTimestamp'`