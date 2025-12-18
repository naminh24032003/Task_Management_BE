# Task Management Platform

Production-ready microservices platform for task management built with Go, Kubernetes, and cloud-native technologies.

[![Terraform](https://img.shields.io/badge/Terraform-1.6+-purple?logo=terraform)](https://www.terraform.io/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28+-blue?logo=kubernetes)](https://kubernetes.io/)
[![Helm](https://img.shields.io/badge/Helm-3.x-0F1689?logo=helm)](https://helm.sh/)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)](https://golang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Cloud Infrastructure                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌───────────────┐    ┌─────────────────┐ │
│  │   Route53    │──▶ │   ALB/NLB     │──▶ │  EKS Cluster    │ │
│  │    (DNS)     │    │ Load Balancer │    │ (Kubernetes)    │ │
│  └──────────────┘    └───────────────┘    └────────┬────────┘ │
│                                                     │          │
│  ┌──────────────────────────────────────────────── │          │
│  │  Kubernetes Workloads                            │          │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────▼────────┐ │
│  │  │ API Gateway │  │ Microservices│  │  Infrastructure  │ │
│  │  │ (Kong)      │  │ (Task, User) │  │ (Kafka, Redis)   │ │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘ │
│  │                                                            │
│  │  ┌─────────────────────────────────────────────────────┐ │
│  │  │        Observability (Prometheus, Grafana, Loki)    │ │
│  │  └─────────────────────────────────────────────────────┘ │
│  └────────────────────────────────────────────────────────── │
│                                                                 │
│  ┌──────────────┐    ┌───────────┐    ┌──────────────────┐  │
│  │ RDS Postgres │    │  S3       │    │  CloudWatch      │  │
│  │  (Database)  │    │ (Storage) │    │  (Logs/Metrics)  │  │
│  └──────────────┘    └───────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
task_management_be/
│
├── terraform/                      # Infrastructure as Code
│   ├── modules/
│   │   ├── eks-cluster/           # AWS EKS cluster module
│   │   ├── vpc/                   # VPC networking module
│   │   ├── rds-postgres/          # PostgreSQL database module
│   │   └── s3-buckets/            # S3 storage module
│   └── environments/
│       ├── dev/                   # Development environment
│       ├── staging/               # Staging environment
│       └── production/            # Production environment
│
├── helm-charts/                    # Kubernetes deployments
│   ├── charts/
│   │   ├── infrastructure/        # Kong, Kafka, Redis, Consul
│   │   ├── observability/         # Prometheus, Grafana, Loki, Jaeger
│   │   └── microservice/          # Reusable microservice template
│   ├── services/                  # Service-specific configurations
│   │   ├── task-service/
│   │   ├── user-service/
│   │   └── ...
│   └── umbrella-chart/            # Deploy everything at once
│
├── services/                       # Microservice source code
│   ├── task-service/              # Task management service (Go)
│   ├── user-service/              # User authentication service (Go)
│   └── ...
│
├── scripts/                        # Automation scripts
│   ├── deploy.sh                  # Full deployment automation
│   ├── destroy.sh                 # Cleanup script
│   └── setup-kubeconfig.sh        # kubectl configuration
│
├── docs/                           # Documentation
│   ├── architecture.md            # System architecture
│   ├── deployment-guide.md        # Deployment instructions
│   └── runbook.md                 # Operations runbook
│
├── .github/workflows/              # CI/CD pipelines
│   ├── terraform-plan.yml         # Terraform validation
│   ├── helm-lint.yml              # Helm chart linting
│   └── deploy-staging.yml         # Automated deployments
│
├── Makefile                        # Common commands
└── README.md                       # This file
```

## 🚀 Quick Start

### Prerequisites

- **AWS Account** with appropriate permissions
- **Tools**:
  - Terraform >= 1.5
  - kubectl >= 1.28
  - Helm >= 3.0
  - AWS CLI v2
  - Make

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourorg/task_management_be.git
   cd task_management_be
   ```

2. **Configure AWS credentials**:
   ```bash
   aws configure
   ```

3. **Set environment variables**:
   ```bash
   export TF_VAR_db_password="SecurePassword123!"
   ```

4. **Deploy to dev environment**:
   ```bash
   make dev
   # Or manually:
   # make tf-init tf-plan tf-apply
   # make k8s-config
   # make helm-deploy-all
   ```

5. **Verify deployment**:
   ```bash
   kubectl get pods -n dev
   ```

## 📝 Usage

### Makefile Commands

View all available commands:
```bash
make help
```

Key commands:
```bash
# Terraform
make tf-init                        # Initialize Terraform
make tf-plan                        # Plan infrastructure changes
make tf-apply                       # Apply infrastructure changes

# Kubernetes
make k8s-config                     # Configure kubectl
make k8s-status                     # Show cluster status

# Helm
make helm-lint                      # Lint all charts
make helm-deploy-all                # Deploy all services

# Monitoring
make port-forward-grafana           # Access Grafana dashboard
make port-forward-prometheus        # Access Prometheus
make port-forward-jaeger            # Access Jaeger tracing

# Environment-specific
make dev                            # Deploy to dev
make staging                        # Deploy to staging
make production                     # Deploy to production
```

### Deployment Script

Automated deployment:
```bash
./scripts/deploy.sh dev             # Deploy dev environment
./scripts/deploy.sh staging         # Deploy staging
./scripts/deploy.sh production      # Deploy production
```

### Manual Deployment

1. **Deploy infrastructure**:
   ```bash
   cd terraform/environments/dev
   terraform init
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

2. **Configure kubectl**:
   ```bash
   aws eks update-kubeconfig --name $(terraform output -raw eks_cluster_name)
   ```

3. **Deploy Helm charts**:
   ```bash
   cd ../../../helm-charts
   helm install infrastructure ./charts/infrastructure -n dev
   helm install observability ./charts/observability -n dev
   helm install task-service ./services/task-service -n dev
   helm install user-service ./services/user-service -n dev
   ```

## 🔍 Monitoring

### Access Dashboards

**Grafana** (Metrics visualization):
```bash
make port-forward-grafana
# Open: http://localhost:3000
# Login: admin / admin
```

**Prometheus** (Metrics collection):
```bash
make port-forward-prometheus
# Open: http://localhost:9090
```

**Jaeger** (Distributed tracing):
```bash
make port-forward-jaeger
# Open: http://localhost:16686
```

## 🏗️ Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Infrastructure** | Terraform | Infrastructure as Code |
| **Orchestration** | Kubernetes (EKS) | Container orchestration |
| **Deployment** | Helm 3 | Package management |
| **API Gateway** | Kong | API management, authentication |
| **Ingress** | NGINX Ingress | Load balancing, routing |
| **Database** | PostgreSQL 15 (RDS) | Primary data store |
| **Cache** | Redis 7 | Session cache, performance |
| **Message Broker** | Apache Kafka | Event streaming |
| **Service Discovery** | Consul | Service registry |
| **Metrics** | Prometheus + Grafana | Monitoring, visualization |
| **Logging** | Loki + Promtail | Log aggregation |
| **Tracing** | Jaeger | Distributed tracing |
| **Language** | Go 1.21+ | Microservices |
| **Framework** | Kratos | Clean architecture |

## 🔐 Security

- **Network**: VPC isolation, private subnets, security groups
- **Authentication**: JWT tokens via Kong API Gateway
- **Authorization**: RBAC in Kubernetes
- **Encryption**: TLS in transit, encryption at rest (RDS, S3)
- **Secrets**: Kubernetes Secrets + AWS Secrets Manager
- **Scanning**: Automated vulnerability scanning (Trivy)

## 📊 Environments

| Environment | Purpose | Auto-Deploy | Approval Required |
|-------------|---------|-------------|-------------------|
| **dev** | Development & testing | ✅ Yes | ❌ No |
| **staging** | Pre-production testing | ✅ Yes | ❌ No |
| **production** | Live environment | ❌ No | ✅ Yes |

## 🛠️ Development

### Local Development

Run services locally with Docker Compose:
```bash
make dev-setup
```

Stop local environment:
```bash
make dev-down
```

### Testing

```bash
make test
```

### Linting

```bash
make validate              # Validate all configurations
make helm-lint             # Lint Helm charts
```

## 📖 Documentation

- [**Architecture Overview**](docs/architecture.md) - System design and components
- [**Deployment Guide**](docs/deployment-guide.md) - Step-by-step deployment
- [**Operations Runbook**](docs/runbook.md) - Troubleshooting and operations

## 🔄 CI/CD

Automated pipelines via GitHub Actions:

- **Terraform Plan**: Validates infrastructure changes on PRs
- **Helm Lint**: Validates Helm charts
- **Deploy to Staging**: Auto-deploys to staging on `develop` branch
- **Deploy to Production**: Manual approval required

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **DevOps Team**: Infrastructure & deployment
- **Backend Team**: Microservices development
- **SRE Team**: Operations & monitoring

## 🆘 Support

- **Documentation**: `docs/`
- **Issues**: GitHub Issues
- **Slack**: #task-management-platform
- **Email**: devops@example.com

## 🗺️ Roadmap

- [x] Core infrastructure with Terraform
- [x] Kubernetes deployment with Helm
- [x] Observability stack (Prometheus, Grafana, Loki, Jaeger)
- [x] CI/CD pipelines
- [ ] ArgoCD GitOps
- [ ] Service mesh (Istio)
- [ ] Multi-region deployment
- [ ] Advanced autoscaling
- [ ] Cost optimization dashboard

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

---

**Built with ❤️ by the Platform Engineering Team**
