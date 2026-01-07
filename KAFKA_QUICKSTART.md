# 🚀 Kafka Quickstart Guide

Hướng dẫn nhanh để deploy và test Kafka trên Minikube trong **5 phút**!

## ✅ Kafka đã sẵn sàng cho:

- ✅ **Pub/Sub giữa các services** (task-service ↔️ user-service)
- ✅ **Kafka UI** để xem messages, topics, consumers real-time
- ✅ **SASL Authentication** bảo mật
- ✅ **Auto-create topics** với retention policies
- ✅ **Production-ready** examples cho Go và Node.js

---

## 📋 Bước 1: Deploy Kafka (2 phút)

```bash
# Clone hoặc cd vào project
cd task_management_be

# Chạy deployment script
chmod +x scripts/kafka/*.sh
./scripts/kafka/deploy-kafka.sh

# Script sẽ:
# ✅ Check Minikube running
# ✅ Enable Kafka trong terraform.tfvars
# ✅ Deploy Kafka với Terraform
# ✅ Wait for pods ready
```

**Kết quả:**
```
✅ Kafka deployed successfully!
📊 Kafka Deployment Status:
NAME                  READY   STATUS    RESTARTS   AGE
kafka-controller-0    1/1     Running   0          2m
kafka-ui-xxxxx        1/1     Running   0          2m
```

---

## 📊 Bước 2: Mở Kafka UI (30 giây)

**Cách 1: Port Forward (recommended)**
```bash
kubectl port-forward -n kafka svc/kafka-ui 8080:8080
```

**Cách 2: Minikube Service**
```bash
minikube service kafka-ui -n kafka
```

**Truy cập:** http://localhost:8080

### 🎨 Kafka UI Features:

1. **Topics** tab → Xem tất cả topics, partitions, messages
2. **Consumers** tab → Monitor consumer groups, lag
3. **Brokers** tab → Kafka cluster health
4. **Messages** tab → Browse, filter, search messages

**Screenshot:**
```
┌─────────────────────────────────────────┐
│  Kafka UI - Dashboard                   │
├─────────────────────────────────────────┤
│  Topics        Consumers    Brokers     │
│                                          │
│  📋 tasks           (3 partitions)      │
│  📋 users           (3 partitions)      │
│  📋 notifications   (3 partitions)      │
│  📋 audit-logs      (5 partitions)      │
│                                          │
│  [Create Topic] [Send Message]          │
└─────────────────────────────────────────┘
```

---

## 📝 Bước 3: Tạo Topics (1 phút)

```bash
./scripts/kafka/create-topics.sh
```

**Tạo các topics:**
- `tasks` - Task events (create, update, delete)
- `users` - User events (register, update, delete)
- `notifications` - Notification messages
- `audit-logs` - System audit logs
- `events` - Generic application events
- `task-assignments` - Task assignment events
- `user-activities` - User activity tracking
- `system-metrics` - System metrics
- `dead-letter-queue` - Failed messages

**Verify trong Kafka UI:**
1. Mở http://localhost:8080
2. Click **Topics** tab
3. Thấy tất cả topics đã được tạo ✅

---

## 🧪 Bước 4: Test Pub/Sub (1 phút)

```bash
./scripts/kafka/test-kafka.sh
```

**Test này sẽ:**
1. ✅ Tạo test topic
2. ✅ Publish 4 test messages
3. ✅ Consume messages và verify
4. ✅ Performance test (100 messages)

**Output:**
```
🧪 Testing Kafka Pub/Sub...
✅ Using Kafka pod: kafka-controller-0
🔐 Setting up authentication...
📤 Producing test messages...
Message 1: {"event":"test","message":"Hello Kafka!"}
Message 2: {"event":"task_created","task_id":"123"}
✅ All messages produced

📥 Consuming messages...
{"event":"test","message":"Hello Kafka!"}
{"event":"task_created","task_id":"123"}
✅ Messages consumed successfully

⚡ Performance Test (100 messages)...
✅ Produced 100 messages in 234ms
   Throughput: 427 messages/second

✅ Kafka cluster is healthy
🎉 Kafka testing completed successfully!
```

---

## 💻 Bước 5: Tích hợp vào Services

### **Option A: Go Service (Task Service)**

```bash
cd examples/kafka/go
go mod init kafka-example
go get github.com/IBM/sarama
```

**Producer:**
```go
// examples/kafka/go/producer.go
go run producer.go
```

**Consumer:**
```go
// examples/kafka/go/consumer.go
go run consumer.go
```

### **Option B: Node.js Service (User Service)**

```bash
cd examples/kafka/nodejs
npm init -y
npm install kafkajs
```

**Producer:**
```bash
node producer.js
```

**Consumer:**
```bash
node consumer.js
```

---

## 🔍 Xem Messages trong Kafka UI

### **Real-time Message Viewing:**

1. **Mở Kafka UI:** http://localhost:8080
2. **Click vào topic** (ví dụ: `tasks`)
3. **Click tab "Messages"**
4. **Browse messages:**
   - 📅 Filter by timestamp
   - 🔍 Search by key/value
   - 📊 View partition distribution
   - 🎯 Jump to specific offset

### **Example: View Task Events**

```
┌──────────────────────────────────────────────────────┐
│  Topic: tasks                                        │
├──────────────────────────────────────────────────────┤
│  Offset  Partition  Timestamp           Message     │
│  0       0          2024-01-07 10:30    task.created│
│  1       1          2024-01-07 10:31    task.updated│
│  2       0          2024-01-07 10:32    task.complet│
│                                                      │
│  [Refresh] [Filter] [Jump to Offset]                │
└──────────────────────────────────────────────────────┘
```

**Click vào message để xem chi tiết:**
```json
{
  "event_type": "task.created",
  "task_id": "task-123",
  "title": "Implement authentication",
  "user_id": "user-456",
  "status": "pending",
  "timestamp": "2024-01-07T10:30:00Z"
}
```

---

## 📡 Connection Info cho Services

### **Environment Variables:**

```bash
# Kafka Connection
export KAFKA_BROKERS=kafka.kafka.svc.cluster.local:9092
export KAFKA_USERNAME=kafka-user
export KAFKA_PASSWORD=kafka-secret-password

# Topics
export KAFKA_TOPIC_TASKS=tasks
export KAFKA_TOPIC_USERS=users
export KAFKA_TOPIC_NOTIFICATIONS=notifications

# Consumer Groups
export KAFKA_CONSUMER_GROUP=task-service-group
```

### **Kubernetes ConfigMap:**

```yaml
# Add to your service values
microservice:
  envVarsCM:
    KAFKA_BROKERS: kafka.kafka.svc.cluster.local:9092
    KAFKA_TOPIC_TASKS: tasks
    KAFKA_CONSUMER_GROUP: task-service-group

  envVarsSecret:
    KAFKA_USERNAME: kafka-user
    KAFKA_PASSWORD: kafka-secret-password
```

---

## 🎯 Use Cases & Examples

### **1. Task Created → Send Notification**

**Task Service (Producer):**
```go
// When task is created
event := TaskEvent{
    EventType: "task.created",
    TaskID:    "task-123",
    Title:     "New task",
    UserID:    "user-456",
}
publishEvent(producer, "tasks", event)
```

**User Service (Consumer):**
```javascript
// Listen for task events
eventHandlers['task.created'] = async (event) => {
    // Send notification to user
    await sendNotification(event.user_id, {
        title: "New Task Assigned",
        body: event.title
    });
};
```

**Xem trong Kafka UI:**
- Topic: `tasks`
- Messages tab → Thấy event `task.created`
- Topic: `notifications` → Thấy notification sent

---

### **2. User Login → Track Activity**

**User Service (Producer):**
```javascript
await publishUserEvent('user.login', {
    userId: 'user-789',
    email: 'user@example.com',
    metadata: { ip: '192.168.1.100' }
});
```

**Analytics Service (Consumer):**
```javascript
// Track user activity
eventHandlers['user.login'] = async (event) => {
    await analytics.track('user_login', {
        user_id: event.user_id,
        ip: event.metadata.ip,
        timestamp: event.timestamp
    });
};
```

**Xem trong Kafka UI:**
- Topic: `users`
- Filter by `event_type: user.login`
- Xem user activities over time

---

### **3. Audit Logging**

**Any Service:**
```javascript
// Publish audit log
await publishEvent('audit-logs', {
    event_type: 'data.accessed',
    user_id: 'admin-123',
    resource: 'user_data',
    action: 'read',
    timestamp: new Date().toISOString()
});
```

**Xem trong Kafka UI:**
- Topic: `audit-logs`
- Browse all audit events
- Export for compliance reporting

---

## 🔧 Troubleshooting

### **Pod không start:**
```bash
kubectl describe pod kafka-controller-0 -n kafka
kubectl logs kafka-controller-0 -n kafka
```

### **Connection refused:**
```bash
# Test connectivity
kubectl run test --rm -ti --image=busybox -- sh
nc -zv kafka.kafka.svc.cluster.local 9092
```

### **Messages không hiện:**
```bash
# Check consumer groups
kubectl exec -n kafka kafka-controller-0 -- kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --command-config /tmp/client.properties \
  --list
```

---

## 📚 Useful Commands

```bash
# View Kafka logs
kubectl logs -n kafka kafka-controller-0 -f

# List topics
kubectl exec -n kafka kafka-controller-0 -- kafka-topics.sh \
  --bootstrap-server kafka:9092 \
  --command-config /tmp/client.properties \
  --list

# Describe topic
kubectl exec -n kafka kafka-controller-0 -- kafka-topics.sh \
  --bootstrap-server kafka:9092 \
  --command-config /tmp/client.properties \
  --describe --topic tasks

# Consumer group lag
kubectl exec -n kafka kafka-controller-0 -- kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --command-config /tmp/client.properties \
  --group task-service-group \
  --describe

# Port-forward Kafka UI
kubectl port-forward -n kafka svc/kafka-ui 8080:8080
```

---

## 🎉 Kết luận

**✅ Bạn đã có:**

1. ✅ Kafka cluster running trên Minikube
2. ✅ Kafka UI để xem messages real-time
3. ✅ Pre-configured topics với retention policies
4. ✅ Working examples cho Go và Node.js
5. ✅ Scripts để test và deploy nhanh
6. ✅ Production-ready configuration

**🚀 Next Steps:**

1. Integrate vào task-service và user-service của bạn
2. Implement event handlers cho business logic
3. Monitor với Kafka UI
4. Scale lên production (EKS) khi ready

**📖 Documentation:**

- [Module README](terraform/modules/platform/kafka/README.md)
- [Deployment Guide](docs/KAFKA_DEPLOYMENT.md)
- [Go Examples](examples/kafka/go/)
- [Node.js Examples](examples/kafka/nodejs/)

---

## ❓ FAQ

**Q: Kafka UI có thể xem log real-time không?**
A: ✅ Có! Mở topic → Messages tab → Auto-refresh ON

**Q: Làm sao để test giữa 2 services?**
A: Run producer trong service A, consumer trong service B, xem messages trong Kafka UI

**Q: Password mặc định là gì?**
A: `kafka-secret-password` (đổi trong `secrets.auto.tfvars`)

**Q: Có thể deploy lên EKS không?**
A: ✅ Có! Chỉ cần set `is_minikube = false` và enable persistence

**Q: Performance như thế nào?**
A: Test script cho ~400-500 msg/s trên Minikube, production EKS sẽ cao hơn nhiều

---

**🎊 Happy Kafka-ing!** 🎊
