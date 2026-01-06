# Task Management Platform

Production-ready microservices platform for task management built with Go, Kubernetes, and cloud-native technologies.

[![Terraform](https://img.shields.io/badge/Terraform-1.6+-purple?logo=terraform)](https://www.terraform.io/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28+-blue?logo=kubernetes)](https://kubernetes.io/)
[![Helm](https://img.shields.io/badge/Helm-3.x-0F1689?logo=helm)](https://helm.sh/)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)](https://golang.org/)

## Cấu trúc Project

```
task_management_be/
├── terraform/                  # Infrastructure as Code
│   ├── modules/               # Reusable modules (VPC, EKS, RDS, Jenkins, ArgoCD)
│   └── environments/          # Dev, Staging, Production
├── helm-charts/               # Kubernetes deployments
├── services/                  # Microservice source code
├── scripts/                   # Automation scripts
└── docs/                      # Documentation
```

## Tech Stack

- **Infrastructure**: AWS (EKS, RDS, S3), Terraform
- **Orchestration**: Kubernetes, Helm
- **CI/CD**: Jenkins (CI) + ArgoCD (CD) - GitOps
- **Gateway**: Kong API Gateway, NGINX Ingress
- **Database**: PostgreSQL 15 (RDS)
- **Cache/Message**: Redis, Kafka, Consul
- **Monitoring**: Prometheus, Grafana, Loki, Jaeger
- **Language**: Go (Kratos framework)

## Quick Start

### Prerequisites
```bash
# Check installations
terraform --version    # >= 1.5
kubectl version        # >= 1.28
helm version          # >= 3.0
aws --version         # AWS CLI v2
```

### Deploy Infrastructure
```bash
# Dev environment
cd terraform/environments/dev
terraform init
terraform apply

# Configure kubectl
aws eks update-kubeconfig --name $(terraform output -raw eks_cluster_name)
```

### Deploy Applications
```bash
cd helm-charts
helm install infrastructure ./charts/infrastructure -n dev
helm install observability ./charts/observability -n dev
helm install task-service ./services/task-service -n dev
```

## CI/CD Pipeline (GitOps)

### Jenkins (CI) - Build & Test
- Build Docker images
- Run tests
- Push to registry
- Update manifest in Git

### ArgoCD (CD) - Deploy
- Monitor Git repositories
- Auto-sync to Kubernetes
- Self-healing applications

### Quick Setup CI/CD

```bash
cd terraform/environments/minikube

# 1. Setup secrets
make setup-secrets
nano secrets.auto.tfvars

# 2. Deploy Jenkins + ArgoCD
terraform apply

# 3. Access services
kubectl port-forward -n jenkins svc/jenkins 8080:80
kubectl port-forward -n argocd svc/argocd-server 8081:80
```

**Login credentials**: Check `secrets.auto.tfvars`

## Monitoring

```bash
# Grafana (Metrics)
kubectl port-forward -n dev svc/observability-grafana 3000:3000
# http://localhost:3000 (admin/admin)

# Prometheus
kubectl port-forward -n dev svc/observability-prometheus 9090:9090

# Jaeger (Tracing)
kubectl port-forward -n dev svc/observability-jaeger 16686:16686
```

## Common Commands

```bash
# Infrastructure
terraform plan
terraform apply
terraform destroy

# Kubernetes
kubectl get pods -n dev
kubectl logs -f <pod-name> -n dev
kubectl describe pod <pod-name> -n dev

# Helm
helm list -n dev
helm upgrade <release> <chart> -n dev
helm rollback <release> -n dev

# ArgoCD
argocd app list
argocd app sync <app-name>
argocd app get <app-name>
```

## Troubleshooting

### Pod không start
```bash
kubectl describe pod <pod-name> -n dev
kubectl logs <pod-name> -n dev --previous
```

### Service không connect được
```bash
kubectl get endpoints -n dev
kubectl get svc -n dev
```

### Database connection
```bash
kubectl get secret db-credentials -n dev -o yaml
kubectl exec -it <pod-name> -n dev -- sh
```

## Environments

| Environment | Purpose | Auto-Deploy |
|-------------|---------|-------------|
| **dev** | Development | ✅ Yes |
| **staging** | Pre-production | ✅ Yes |
| **production** | Live | Manual approval |

## Security

- VPC isolation với private subnets
- JWT authentication via Kong
- RBAC trong Kubernetes
- TLS encryption (in-transit)
- Encryption at rest (RDS, S3)
- Kubernetes Secrets + AWS Secrets Manager

## Architecture

```
Internet → Route53 → ALB → NGINX/Kong → Microservices
                                        ↓
                            Infrastructure (Kafka, Redis)
                                        ↓
                            Observability (Prometheus, Grafana)
                                        ↓
                            AWS Services (RDS, S3, CloudWatch)
```

## License

MIT

---

**Built by Platform Engineering Team**
