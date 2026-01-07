# Kafka Deployment Guide

Hướng dẫn triển khai Apache Kafka trên Minikube và chuẩn bị cho EKS.

## Tổng quan

Module Kafka này sử dụng:
- **Bitnami Kafka Helm Chart** với KRaft mode (không cần Zookeeper)
- **SASL/SCRAM-SHA-256** authentication
- **Kafka UI** cho monitoring và quản lý
- **Terraform** để quản lý infrastructure as code

## Kiến trúc

```
┌────────────────────────────────────────────────────┐
│              Minikube Cluster                      │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │          Kafka Namespace                     │ │
│  │                                              │ │
│  │  ┌────────────────────────────────────────┐ │ │
│  │  │  Kafka Controller (KRaft Mode)        │ │ │
│  │  │  - Acts as broker + controller        │ │ │
│  │  │  - Port: 9092                         │ │ │
│  │  │  - SASL/SCRAM authentication          │ │ │
│  │  │  - Resources: 100m CPU / 256Mi RAM    │ │ │
│  │  └────────────────────────────────────────┘ │ │
│  │                                              │ │
│  │  ┌────────────────────────────────────────┐ │ │
│  │  │  Kafka UI                             │ │ │
│  │  │  - Web interface on port 8080         │ │ │
│  │  │  - Topic management                   │ │ │
│  │  │  - Consumer monitoring                │ │ │
│  │  └────────────────────────────────────────┘ │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Microservices có thể kết nối đến:                │
│  kafka.kafka.svc.cluster.local:9092               │
└────────────────────────────────────────────────────┘
```

## Yêu cầu hệ thống

### Minikube
- **CPU**: Tối thiểu 4 cores (khuyến nghị 6+)
- **RAM**: Tối thiểu 8GB (khuyến nghị 12GB+)
- **Disk**: 20GB trống

### Công cụ cần thiết
- Terraform >= 1.0
- kubectl
- Minikube
- Helm (được Terraform quản lý)

## Cài đặt

### Bước 1: Khởi động Minikube

```bash
# Khởi động Minikube với đủ resources
minikube start --cpus=6 --memory=12288 --disk-size=30g

# Kiểm tra cluster
kubectl cluster-info
kubectl get nodes
```

### Bước 2: Cấu hình Terraform Variables

```bash
cd terraform/environments/minikube

# Copy example files
cp terraform.tfvars.example terraform.tfvars
cp secrets.auto.tfvars.example secrets.auto.tfvars
```

### Bước 3: Enable Kafka

Chỉnh sửa `terraform.tfvars`:

```hcl
# =========================
# Platform Components
# =========================
monitoring_enabled = true
logging_enabled    = true
istio_enabled      = true
mongodb_enabled    = false
kafka_enabled      = true  # <-- Enable Kafka

# Kafka Configuration
kafka_persistence_enabled = false  # Không cần persistence cho dev
```

### Bước 4: Cấu hình Secrets

Chỉnh sửa `secrets.auto.tfvars`:

```hcl
# Jenkins
jenkins_password = "your-jenkins-password"

# ArgoCD
argocd_admin_password = "your-argocd-password"
argocd_redis_password = "your-redis-password"

# Kafka
kafka_sasl_password = "KafkaSecur3P@ssw0rd2024"  # <-- Đặt password mạnh
```

### Bước 5: Deploy Kafka

```bash
cd terraform/environments/minikube

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply configuration
terraform apply

# Confirm with: yes
```

### Bước 6: Verify Deployment

```bash
# Check namespace
kubectl get namespace kafka

# Check pods
kubectl get pods -n kafka

# Should see:
# NAME                        READY   STATUS    RESTARTS   AGE
# kafka-controller-0          1/1     Running   0          2m
# kafka-ui-xxxxx-xxxxx        1/1     Running   0          2m

# Check services
kubectl get svc -n kafka

# Should see:
# NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
# kafka        ClusterIP   10.96.xxx.xxx   <none>        9092/TCP   2m
# kafka-ui     ClusterIP   10.96.xxx.xxx   <none>        8080/TCP   2m
```

## Truy cập Kafka UI

### Method 1: Port Forward

```bash
# Forward Kafka UI to localhost
kubectl port-forward -n kafka svc/kafka-ui 8080:8080

# Mở browser
http://localhost:8080
```

### Method 2: Minikube Service

```bash
# Expose service via Minikube
minikube service kafka-ui -n kafka

# Minikube sẽ tự động mở browser
```

## Test Kafka Connection

### Test 1: Tạo Topic

```bash
# Run Kafka client pod
kubectl run kafka-client -n kafka --rm -ti \
  --image=bitnami/kafka:latest -- bash

# Inside the pod, tạo client config
cat > /tmp/client.properties <<EOF
security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-256
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required \
  username="kafka-user" \
  password="KafkaSecur3P@ssw0rd2024";
EOF

# Tạo test topic
kafka-topics.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --command-config /tmp/client.properties \
  --create --topic test-topic \
  --partitions 3 --replication-factor 1

# List topics
kafka-topics.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --command-config /tmp/client.properties \
  --list

# Describe topic
kafka-topics.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --command-config /tmp/client.properties \
  --describe --topic test-topic
```

### Test 2: Producer & Consumer

```bash
# Terminal 1: Producer
kubectl run kafka-producer -n kafka --rm -ti \
  --image=bitnami/kafka:latest -- bash

# Inside producer pod
cat > /tmp/client.properties <<EOF
security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-256
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required \
  username="kafka-user" \
  password="KafkaSecur3P@ssw0rd2024";
EOF

kafka-console-producer.sh \
  --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --producer.config /tmp/client.properties \
  --topic test-topic

# Type messages and press Enter
> Hello Kafka!
> Message from producer
```

```bash
# Terminal 2: Consumer
kubectl run kafka-consumer -n kafka --rm -ti \
  --image=bitnami/kafka:latest -- bash

# Inside consumer pod
cat > /tmp/client.properties <<EOF
security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-256
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required \
  username="kafka-user" \
  password="KafkaSecur3P@ssw0rd2024";
EOF

kafka-console-consumer.sh \
  --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --consumer.config /tmp/client.properties \
  --topic test-topic \
  --from-beginning

# Bạn sẽ thấy messages từ producer
```

## Tích hợp với Microservices

### Go Service (Task Service)

```go
package main

import (
    "github.com/IBM/sarama"
    "log"
)

func main() {
    config := sarama.NewConfig()
    config.Net.SASL.Enable = true
    config.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
    config.Net.SASL.User = "kafka-user"
    config.Net.SASL.Password = "KafkaSecur3P@ssw0rd2024"
    config.Producer.Return.Successes = true

    brokers := []string{"kafka.kafka.svc.cluster.local:9092"}

    producer, err := sarama.NewSyncProducer(brokers, config)
    if err != nil {
        log.Fatalf("Failed to create producer: %v", err)
    }
    defer producer.Close()

    // Send message
    msg := &sarama.ProducerMessage{
        Topic: "tasks",
        Value: sarama.StringEncoder("Task created"),
    }

    partition, offset, err := producer.SendMessage(msg)
    if err != nil {
        log.Printf("Failed to send message: %v", err)
    } else {
        log.Printf("Message sent to partition %d at offset %d", partition, offset)
    }
}
```

### Node.js Service (User Service)

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'user-service',
  brokers: ['kafka.kafka.svc.cluster.local:9092'],
  sasl: {
    mechanism: 'scram-sha-256',
    username: 'kafka-user',
    password: 'KafkaSecur3P@ssw0rd2024'
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'user-service-group' });

async function run() {
  // Producer
  await producer.connect();
  await producer.send({
    topic: 'users',
    messages: [
      { value: 'User created' }
    ]
  });

  // Consumer
  await consumer.connect();
  await consumer.subscribe({ topic: 'users', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log({
        value: message.value.toString(),
        partition,
        offset: message.offset
      });
    }
  });
}

run().catch(console.error);
```

### Environment Variables cho Services

Thêm vào values files của microservices:

```yaml
# apps/task-service/values-minikube.yaml
microservice:
  envVarsCM:
    GO_ENV: development
    KAFKA_BROKERS: kafka.kafka.svc.cluster.local:9092
    KAFKA_TOPIC_TASKS: tasks

  envVarsSecret:
    KAFKA_USERNAME: kafka-user
    KAFKA_PASSWORD: KafkaSecur3P@ssw0rd2024
```

## Common Kafka Topics

Tạo các topics chuẩn cho hệ thống:

```bash
# Tạo script để tạo topics
cat > create-topics.sh <<'EOF'
#!/bin/bash

BROKERS="kafka.kafka.svc.cluster.local:9092"
CONFIG="/tmp/client.properties"

# Topics list
TOPICS=(
  "tasks:3:1"           # tasks:partitions:replication-factor
  "users:3:1"
  "notifications:3:1"
  "audit-logs:5:1"
  "events:5:1"
)

for topic_config in "${TOPICS[@]}"; do
  IFS=':' read -r topic partitions replication <<< "$topic_config"

  echo "Creating topic: $topic"
  kafka-topics.sh --bootstrap-server $BROKERS \
    --command-config $CONFIG \
    --create --if-not-exists \
    --topic $topic \
    --partitions $partitions \
    --replication-factor $replication \
    --config retention.ms=604800000 \
    --config compression.type=lz4
done

echo "Topics created successfully!"
EOF

chmod +x create-topics.sh

# Run trong Kafka client pod
kubectl cp create-topics.sh kafka-client:/tmp/create-topics.sh -n kafka
kubectl exec -it kafka-client -n kafka -- /tmp/create-topics.sh
```

## Monitoring với Kafka UI

Kafka UI cung cấp:

1. **Topics Management**
   - View all topics
   - Create/delete topics
   - Configure topic settings
   - Browse messages

2. **Consumers**
   - View consumer groups
   - Monitor lag
   - Reset offsets

3. **Brokers**
   - Broker health
   - Configuration
   - Metrics

4. **Messages**
   - Send test messages
   - View message contents
   - Filter by key/value

## Performance Tuning

### Minikube Resources

Nếu gặp performance issues:

```bash
# Stop Minikube
minikube stop

# Restart với nhiều resources hơn
minikube start --cpus=8 --memory=16384 --disk-size=40g

# Re-apply Terraform
cd terraform/environments/minikube
terraform apply
```

### Kafka Configuration

Điều chỉnh trong [values.yaml](../terraform/modules/platform/kafka/values.yaml):

```yaml
# Increase heap size for better performance
heapOpts: "-Xmx1024m -Xms1024m"

# Adjust buffer sizes
socketSendBufferBytes: 204800
socketReceiveBufferBytes: 204800

# More network threads
numNetworkThreads: 6
numIoThreads: 16
```

## Troubleshooting

### Pod không start

```bash
# Check pod status
kubectl describe pod kafka-controller-0 -n kafka

# View logs
kubectl logs kafka-controller-0 -n kafka

# Common issues:
# - Insufficient memory: Increase Minikube memory
# - PVC binding: Check storage class
# - Image pull: Check network connection
```

### Connection refused

```bash
# Check service
kubectl get svc kafka -n kafka

# Test connectivity from another pod
kubectl run test-pod --rm -ti --image=busybox -- sh
nc -zv kafka.kafka.svc.cluster.local 9092

# Check authentication
# Ensure credentials match in client config
```

### Kafka UI không load

```bash
# Check Kafka UI logs
kubectl logs -n kafka deployment/kafka-ui

# Verify Kafka is running
kubectl get pods -n kafka

# Check service
kubectl get svc kafka-ui -n kafka
```

## Cleanup

### Xóa Kafka deployment

```bash
cd terraform/environments/minikube

# Set kafka_enabled = false in terraform.tfvars
# Then apply
terraform apply

# Hoặc destroy toàn bộ
terraform destroy
```

### Xóa Kafka data

```bash
# Delete namespace và tất cả resources
kubectl delete namespace kafka

# Delete PVCs nếu có
kubectl delete pvc -n kafka --all
```

## Chuẩn bị cho EKS

Khi deploy lên EKS production:

### 1. Update terraform.tfvars

```hcl
# terraform/environments/prod/terraform.tfvars
kafka_enabled = true
kafka_persistence_enabled = true  # Enable persistence

# Controller configuration
controller_replica_count = 3  # HA setup
```

### 2. Update module configuration

```hcl
# terraform/environments/prod/main.tf
module "kafka" {
  source = "../../modules/platform/kafka"

  # Production settings
  controller_resources = {
    requests = { cpu = "500m", memory = "1Gi" }
    limits   = { cpu = "2000m", memory = "2Gi" }
  }

  controller_persistence_size = "10Gi"
  storage_class = "gp3"

  is_minikube = false  # Important!
}
```

### 3. Security enhancements

- Enable TLS encryption
- Use AWS Secrets Manager for credentials
- Configure network policies
- Enable audit logging

### 4. Monitoring

- Integrate with CloudWatch
- Set up Prometheus alerts
- Configure Grafana dashboards

## Best Practices

1. **Development**
   - Use Kafka UI để debug và test
   - Tạo test topics riêng
   - Set retention ngắn cho dev topics

2. **Production**
   - Enable persistence
   - Use 3+ replicas cho HA
   - Set appropriate retention policies
   - Monitor consumer lag
   - Enable TLS/SSL

3. **Security**
   - Rotate passwords định kỳ
   - Use network policies
   - Audit access logs
   - Encrypt sensitive data

## References

- [Bitnami Kafka Chart](https://github.com/bitnami/charts/tree/main/bitnami/kafka)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Kafka UI Documentation](https://docs.kafka-ui.provectus.io/)
- [KRaft Mode](https://kafka.apache.org/documentation/#kraft)

## Support

Nếu gặp vấn đề:
1. Check logs: `kubectl logs -n kafka <pod-name>`
2. Check resources: `kubectl top pods -n kafka`
3. Review configuration in terraform state
4. Consult Kafka documentation
