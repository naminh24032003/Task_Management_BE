# Jenkins Minikube Environment

Terraform configuration để deploy Jenkins trên Minikube.

## Quick Start

```bash
# 1. Start Minikube
minikube start --cpus=4 --memory=8192 --disk-size=20g

# 2. Setup Secrets (IMPORTANT!)
make setup-secrets
# Edit secrets.auto.tfvars và set password của bạn
nano secrets.auto.tfvars

# 3. Deploy
make init
make apply

# 4. Access
make access
# or
minikube service jenkins -n jenkins
```

## 🔐 Secrets Management

**IMPORTANT:** This project uses separate files for sensitive data!

- **secrets.auto.tfvars** - Your passwords/tokens (GITIGNORED, never committed)
- **terraform.tfvars** - Non-sensitive config (optional)

See [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md) for complete guide.

## Configuration

### Secrets (in secrets.auto.tfvars)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `jenkins_password` | ✅ **YES** | Jenkins admin password (min 8 chars) | `MySecurePassword123!` |
| `jenkins_user` | No | Jenkins username | `admin` (default) |

### Configuration (in terraform.tfvars - optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `enable_jenkins_init_scripts` | `false` | Enable init groovy scripts |
| `jenkins_deployment_namespace` | `default` | Target namespace for deployments |

## Resources Allocated

### Jenkins Master
- **CPU Request**: 250m
- **CPU Limit**: 1000m
- **Memory Request**: 256Mi
- **Memory Limit**: 1024Mi
- **Storage**: 5Gi (standard storage class)

### Jenkins Agents
- **Container Cap**: 5 concurrent agents
- **Resources**: Small preset from Bitnami chart

## Accessing Jenkins

### Method 1: Minikube Service (Recommended)

```bash
minikube service jenkins -n jenkins
```

This will automatically open Jenkins in your browser.

### Method 2: NodePort

```bash
# Get NodePort
kubectl get svc -n jenkins jenkins -o jsonpath='{.spec.ports[0].nodePort}'

# Get Minikube IP
minikube ip

# Access at http://<minikube-ip>:<node-port>
```

### Method 3: Port Forward

```bash
kubectl port-forward -n jenkins svc/jenkins 8080:80
# Access at http://localhost:8080
```

## Verification

```bash
# Check all resources
kubectl get all -n jenkins

# Check pod logs
kubectl logs -n jenkins -l app.kubernetes.io/name=jenkins

# Check persistent volume
kubectl get pvc -n jenkins
```

## Customization

### Enable Init Scripts

1. Edit `terraform.tfvars`:
```hcl
enable_jenkins_init_scripts = true
```

2. Update `jenkins.tf` to add your scripts:
```hcl
locals {
  jenkins_init_scripts = {
    "my-script.groovy" = file("${path.module}/scripts/my-script.groovy")
  }
}
```

3. Apply changes:
```bash
terraform apply
```

### Change Resources

Edit `jenkins.tf` and modify the `resources` block:

```hcl
resources = {
  requests = {
    cpu    = "500m"
    memory = "512Mi"
  }
  limits = {
    cpu    = "2000m"
    memory = "2048Mi"
  }
}
```

## Cleanup

```bash
# Destroy all resources
terraform destroy

# Or just delete namespace
kubectl delete namespace jenkins
```

## Troubleshooting

### Pod won't start

```bash
# Check pod status
kubectl describe pod -n jenkins <pod-name>

# Check events
kubectl get events -n jenkins --sort-by='.lastTimestamp'
```

### Insufficient resources

Increase Minikube resources:

```bash
minikube stop
minikube delete
minikube start --cpus=6 --memory=12288 --disk-size=30g
```

### Can't access UI

```bash
# Check service
kubectl get svc -n jenkins

# Check if pod is running
kubectl get pods -n jenkins

# Use port-forward as fallback
kubectl port-forward -n jenkins svc/jenkins 8080:80
```

## Next Steps

1. **Configure Kubernetes Cloud**: See [Jenkins Setup Guide](../../../docs/jenkins-setup.md#cấu-hình-jenkins)
2. **Create Pipelines**: See [Pipeline Examples](../../../docs/jenkins-setup.md#tạo-pipeline-jobs)
3. **Setup Webhooks**: See [Webhook Guide](../../../docs/jenkins-setup.md#webhook-triggered-pipeline)

## Migration to Production

Khi ready để migrate lên EKS:

1. Backup Jenkins data:
```bash
kubectl exec -n jenkins <pod-name> -- tar czf /tmp/backup.tar.gz /bitnami/jenkins/home
kubectl cp jenkins/<pod-name>:/tmp/backup.tar.gz ./jenkins-backup.tar.gz
```

2. Follow [EKS Setup Guide](../../../docs/jenkins-setup.md#setup-trên-eks)

3. Restore data to EKS Jenkins instance

## Resources

- [Module Documentation](../../modules/jenkins/README.md)
- [Full Setup Guide](../../../docs/jenkins-setup.md)
- [Quick Start](../../modules/jenkins/QUICKSTART.md)