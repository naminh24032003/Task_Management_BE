# Kafka Platform Module

Terraform module to deploy Apache Kafka on Kubernetes using Bitnami Helm chart.

## Features

- **KRaft Mode**: Modern Kafka without Zookeeper dependency
- **SASL/SCRAM Authentication**: Secure authentication using SCRAM-SHA-256
- **Kafka UI**: Web-based management interface for monitoring and managing Kafka
- **Resource Optimized**: Configurable resources for different environments
- **Multi-Environment**: Supports Minikube, EKS, and other Kubernetes platforms
- **Persistence**: Optional persistent storage for production environments
- **Prometheus Metrics**: Built-in metrics exporters for monitoring

## Architecture

```
┌─────────────────────────────────────────┐
│         Kubernetes Cluster              │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │    Kafka Namespace              │  │
│  │                                 │  │
│  │  ┌─────────────────────────┐   │  │
│  │  │  Kafka Controller       │   │  │
│  │  │  (KRaft Mode)           │   │  │
│  │  │  - Broker + Controller  │   │  │
│  │  │  - Port: 9092           │   │  │
│  │  │  - SASL/SCRAM Auth      │   │  │
│  │  └─────────────────────────┘   │  │
│  │                                 │  │
│  │  ┌─────────────────────────┐   │  │
│  │  │  Kafka UI               │   │  │
│  │  │  - Web Interface        │   │  │
│  │  │  - Port: 8080           │   │  │
│  │  └─────────────────────────┘   │  │
│  │                                 │  │
│  └─────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

## Usage

### Basic Usage (Minikube)

```hcl
module "kafka" {
  source = "../../modules/platform/kafka"

  environment      = "dev"
  namespace        = "kafka"
  create_namespace = true

  # Authentication
  sasl_user     = "kafka-user"
  sasl_password = var.kafka_sasl_password

  # Controller (KRaft mode)
  controller_replica_count = 1
  controller_resources = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { cpu = "500m", memory = "512Mi" }
  }

  # Storage (disabled for dev)
  persistence_enabled = false

  # Kafka UI
  kafka_ui_enabled = true

  # Platform
  is_minikube = true
}
```

### Production Usage (EKS)

```hcl
module "kafka" {
  source = "../../modules/platform/kafka"

  environment      = "prod"
  namespace        = "kafka"
  create_namespace = true

  # Authentication
  sasl_user     = "kafka-user"
  sasl_password = var.kafka_sasl_password

  # Controller (3 replicas for HA)
  controller_replica_count = 3
  controller_resources = {
    requests = { cpu = "500m", memory = "1Gi" }
    limits   = { cpu = "2000m", memory = "2Gi" }
  }
  controller_persistence_size     = "10Gi"
  controller_log_persistence_size = "5Gi"

  # Storage (enabled for prod)
  persistence_enabled = true
  storage_class       = "gp3"

  # Kafka UI
  kafka_ui_enabled = true

  # Platform
  is_minikube = false
}
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| kubernetes | >= 2.0 |
| helm | >= 2.0 |

## Providers

| Name | Version |
|------|---------|
| kubernetes | >= 2.0 |
| helm | >= 2.0 |

## Resources

| Name | Type |
|------|------|
| kubernetes_namespace.kafka | resource |
| kubernetes_secret.kafka_sasl | resource |
| helm_release.kafka | resource |
| kubernetes_deployment.kafka_ui | resource |
| kubernetes_service.kafka_ui | resource |
| kubernetes_service.kafka | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| environment | Environment name (dev, staging, prod) | `string` | n/a | yes |
| namespace | Kubernetes namespace for Kafka | `string` | `"kafka"` | no |
| create_namespace | Create the namespace if it doesn't exist | `bool` | `true` | no |
| sasl_user | SASL username for Kafka authentication | `string` | `"kafka-user"` | no |
| sasl_password | SASL password for Kafka authentication | `string` | n/a | yes |
| controller_replica_count | Number of Kafka controller replicas | `number` | `1` | no |
| controller_resources | Resource requests and limits for controllers | `object` | See defaults | no |
| controller_persistence_size | Persistent volume size for controller data | `string` | `"2Gi"` | no |
| controller_log_persistence_size | Persistent volume size for controller logs | `string` | `"1Gi"` | no |
| broker_replica_count | Number of Kafka broker replicas (0 for KRaft mode) | `number` | `0` | no |
| persistence_enabled | Enable persistent storage for Kafka | `bool` | `false` | no |
| storage_class | Storage class for persistent volumes | `string` | `""` | no |
| kafka_ui_enabled | Enable Kafka UI deployment | `bool` | `true` | no |
| service_type | Kubernetes service type | `string` | `"ClusterIP"` | no |
| is_minikube | Whether running on Minikube | `bool` | `false` | no |

## Outputs

| Name | Description |
|------|-------------|
| namespace | Kafka namespace |
| kafka_bootstrap_servers | Full Kafka bootstrap servers connection string |
| kafka_host | Kafka bootstrap server host |
| kafka_port | Kafka bootstrap server port |
| kafka_ui_url | Kafka UI internal URL |
| sasl_user | Kafka SASL username |
| kafka_connection_string | Complete Kafka connection string with SASL settings |

## KRaft Mode

This module uses Kafka in **KRaft mode** (Kafka Raft), which removes the dependency on Apache Zookeeper. In KRaft mode:

- Controllers act as both brokers and consensus nodes
- Simplified architecture with fewer components
- Better performance and scalability
- Recommended for new Kafka deployments

## Authentication

The module uses **SASL/SCRAM-SHA-256** authentication:

```yaml
Security Protocol: SASL_PLAINTEXT
SASL Mechanism: SCRAM-SHA-256
Username: kafka-user (configurable)
Password: Provided via variable (sensitive)
```

### Connecting to Kafka

```bash
# From within the cluster
bootstrap-servers: kafka.kafka.svc.cluster.local:9092

# JAAS Config for clients
security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-256
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required \
  username="kafka-user" \
  password="your-password";
```

## Kafka UI

The module deploys [Kafka UI](https://github.com/provectus/kafka-ui) for cluster management:

### Features
- Topic management (create, delete, view messages)
- Consumer group monitoring
- Broker information
- Configuration management
- Message browser

### Accessing Kafka UI

```bash
# Port-forward to localhost
kubectl port-forward -n kafka svc/kafka-ui 8080:8080

# Open in browser
http://localhost:8080
```

## Resource Presets

The module provides sensible defaults optimized for different environments:

### Minikube/Development
- Controller: 100m CPU, 256Mi Memory
- Limits: 500m CPU, 512Mi Memory
- No persistence

### Production
- Controller: 500m CPU, 1Gi Memory
- Limits: 2000m CPU, 2Gi Memory
- Persistence enabled
- Multiple replicas for HA

## Persistence

### Minikube (Development)
```hcl
persistence_enabled = false
```

### Production (EKS)
```hcl
persistence_enabled = true
storage_class       = "gp3"
controller_persistence_size     = "10Gi"
controller_log_persistence_size = "5Gi"
```

## Monitoring

The module enables Prometheus metrics by default:

```yaml
metrics:
  kafka:
    enabled: true
  jmx:
    enabled: true
```

Metrics are exposed on port 9308 and can be scraped by Prometheus ServiceMonitor.

## Testing Connection

### Using kubectl

```bash
# Run a Kafka client pod
kubectl run kafka-client --rm -ti --image=bitnami/kafka:latest -- bash

# Inside the pod, create a test topic
kafka-topics.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --command-config /opt/bitnami/kafka/config/client.properties \
  --create --topic test-topic --partitions 3 --replication-factor 1

# Producer
kafka-console-producer.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --producer.config /opt/bitnami/kafka/config/client.properties \
  --topic test-topic

# Consumer
kafka-console-consumer.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --consumer.config /opt/bitnami/kafka/config/client.properties \
  --topic test-topic --from-beginning
```

### Client Configuration

Create `/opt/bitnami/kafka/config/client.properties`:

```properties
security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-256
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required \
  username="kafka-user" \
  password="your-kafka-password";
```

## Common Topics Configuration

```hcl
# These settings are in values.yaml template
autoCreateTopicsEnable: true
deleteTopicEnable: true
defaultReplicationFactor: 1
minInsyncReplicas: 1
logRetentionHours: 168
compressionType: producer
```

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -n kafka
kubectl describe pod kafka-controller-0 -n kafka
```

### View Logs
```bash
kubectl logs -n kafka kafka-controller-0
kubectl logs -n kafka deployment/kafka-ui
```

### Check Service
```bash
kubectl get svc -n kafka
kubectl describe svc kafka -n kafka
```

### Test Connectivity
```bash
kubectl run -n kafka kafka-test --rm -ti --image=busybox -- sh
# Inside pod:
nc -zv kafka.kafka.svc.cluster.local 9092
```

## Migration from Zookeeper

If migrating from Zookeeper-based Kafka:

1. This module uses KRaft mode only (no Zookeeper)
2. Data migration requires careful planning
3. Consider running parallel clusters during migration
4. Update client configurations to new bootstrap servers

## Security Considerations

1. **Passwords**: Store `sasl_password` in encrypted state or secret manager
2. **Network Policies**: Consider adding NetworkPolicy resources
3. **TLS**: For production, consider enabling TLS (requires cert-manager)
4. **RBAC**: Apply principle of least privilege for service accounts

## License

Apache 2.0 - Bitnami Kafka Chart
