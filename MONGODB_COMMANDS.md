# MongoDB Sharding - Câu lệnh kiểm tra

## 🎯 Tổng quan Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MongoDB Sharding Cluster                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────────────────┐      │
│  │   Mongos     │ ◄─────► │   Config Servers (3)     │      │
│  │ (Router/LB)  │         │   - Metadata             │      │
│  │   2 pods     │         │   - Chunk info           │      │
│  └──────┬───────┘         └──────────────────────────┘      │
│         │                                                     │
│         │ Load Balance                                       │
│         │                                                     │
│    ┌────┴───────┬───────────┬────────────┐                  │
│    │            │           │            │                  │
│  ┌─▼────┐   ┌──▼─────┐  ┌──▼─────┐                         │
│  │Shard0│   │Shard1  │  │Shard2  │                         │
│  │3 pods│   │3 pods  │  │3 pods  │                         │
│  │ P+2S │   │ P+2S   │  │ P+2S   │                         │
│  └──────┘   └────────┘  └────────┘                         │
│                                                               │
│  Total: 3 shards x 3 replicas = 9 data pods                 │
│         + 3 config servers                                   │
│         + 2 mongos routers                                   │
│         = 14 pods total                                      │
└─────────────────────────────────────────────────────────────┘
```

**P** = PRIMARY, **S** = SECONDARY

---

## 📋 Các lệnh cơ bản

### 1. Kiểm tra Pods

```bash
# Tất cả pods MongoDB
kubectl get pods -n mongodb

# Chỉ xem shards
kubectl get pods -n mongodb | grep shard

# Xem với IP
kubectl get pods -n mongodb -o wide
```

### 2. Kiểm tra StatefulSets

```bash
# Tất cả StatefulSets
kubectl get statefulsets -n mongodb

# Chi tiết
kubectl describe statefulset mongodb-sharded-shard0-data -n mongodb
```

### 3. Kiểm tra Services

```bash
# Services
kubectl get svc -n mongodb

# Chi tiết service chính
kubectl describe svc mongodb-sharded -n mongodb
```

---

## 🔍 Kiểm tra Sharding

### 1. Sharding Status (Tổng quan)

```bash
# Lấy tên mongos pod (thay thế trong các lệnh sau)
export MONGOS_POD=$(kubectl get pods -n mongodb -l app.kubernetes.io/component=mongos -o jsonpath='{.items[0].metadata.name}')

# Xem toàn bộ sharding status
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval "sh.status()"
```

### 2. Kiểm tra 3 Shards

```bash
# Chỉ xem danh sách shards
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval "sh.status()" | grep -A 15 "^shards"
```

**Kết quả mong đợi:** 3 shards
- `mongodb-sharded-shard-0`
- `mongodb-sharded-shard-1`
- `mongodb-sharded-shard-2`

### 3. Kiểm tra Data Distribution (Phân tán dữ liệu)

```bash
# Xem dữ liệu được phân bố như thế nào
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval 'db.getSiblingDB("taskmanagement").tasks.getShardDistribution()'
```

**Kết quả mong đợi:**
- Shard 0: ~33% data
- Shard 1: ~33% data
- Shard 2: ~33% data

---

## 🔄 Kiểm tra Replica Sets

### 1. Shard 0 Replica Set

```bash
# Full status
kubectl exec mongodb-sharded-shard0-data-0 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval "rs.status()"

# Chỉ xem members
kubectl exec mongodb-sharded-shard0-data-0 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval "rs.status()" | grep -E "(name|stateStr)"
```

**Kết quả mong đợi:**
- `shard0-data-0`: PRIMARY
- `shard0-data-1`: SECONDARY
- `shard0-data-2`: SECONDARY

### 2. Shard 1 Replica Set

```bash
kubectl exec mongodb-sharded-shard1-data-0 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval "rs.status()" | grep -E "(name|stateStr)"
```

### 3. Shard 2 Replica Set

```bash
kubectl exec mongodb-sharded-shard2-data-0 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval "rs.status()" | grep -E "(name|stateStr)"
```

### 4. Config Server Replica Set

```bash
kubectl exec mongodb-sharded-configsvr-0 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval "rs.status()" | grep -E "(name|stateStr)"
```

**Kết quả mong đợi:**
- `configsvr-0`: PRIMARY
- `configsvr-1`: SECONDARY
- `configsvr-2`: SECONDARY

---

## 📊 Kiểm tra Dữ liệu

### 1. Đếm Documents

```bash
# Tổng số documents
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval 'db.getSiblingDB("taskmanagement").tasks.countDocuments({})'

# Đếm theo status
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval 'db.getSiblingDB("taskmanagement").tasks.countDocuments({status: "pending"})'
```

### 2. Query Dữ liệu

```bash
# Xem 5 documents đầu
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval 'db.getSiblingDB("taskmanagement").tasks.find().limit(5)'

# Query theo điều kiện
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval 'db.getSiblingDB("taskmanagement").tasks.find({status: "completed"}).limit(3)'
```

### 3. Insert Dữ liệu

```bash
# Insert 1 document
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval 'db.getSiblingDB("taskmanagement").tasks.insertOne({title: "My Task", status: "pending", createdAt: new Date()})'

# Insert nhiều documents
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval '
for(let i = 1; i <= 50; i++) {
  db.getSiblingDB("taskmanagement").tasks.insertOne({
    title: "Task " + i,
    status: i % 3 == 0 ? "completed" : "pending",
    createdAt: new Date()
  });
}'
```

---

## 🧪 Test High Availability (Failover)

### 1. Kiểm tra PRIMARY hiện tại

```bash
kubectl exec mongodb-sharded-shard0-data-0 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval "rs.isMaster()" | grep primary
```

### 2. Xóa PRIMARY để test failover

```bash
# Xóa PRIMARY của shard 0
kubectl delete pod mongodb-sharded-shard0-data-0 -n mongodb

# Đợi 10 giây
sleep 10

# Kiểm tra PRIMARY mới
kubectl exec mongodb-sharded-shard0-data-1 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval "rs.status()" | grep -E "stateStr"
```

**Kết quả mong đợi:**
- Một trong `shard0-data-1` hoặc `shard0-data-2` sẽ trở thành PRIMARY
- Data vẫn accessible
- Pod `shard0-data-0` tự động recreate

### 3. Verify data sau failover

```bash
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --eval 'db.getSiblingDB("taskmanagement").tasks.countDocuments({})'
```

---

## 📈 Monitoring

### 1. Xem Logs

```bash
# Mongos logs
kubectl logs $MONGOS_POD -n mongodb --tail=50

# Shard logs
kubectl logs mongodb-sharded-shard0-data-0 -n mongodb --tail=50

# Config server logs
kubectl logs mongodb-sharded-configsvr-0 -n mongodb --tail=50

# Follow logs (real-time)
kubectl logs -f $MONGOS_POD -n mongodb
```

### 2. Resource Usage

```bash
# Pod resource usage
kubectl top pods -n mongodb

# Node usage
kubectl top nodes
```

### 3. Describe Pods

```bash
# Chi tiết pod
kubectl describe pod $MONGOS_POD -n mongodb

# Events
kubectl get events -n mongodb --sort-by='.lastTimestamp'
```

---

## 🔧 Operations

### 1. Port Forward (Connect từ local)

```bash
# Forward mongos service
kubectl port-forward -n mongodb svc/mongodb-sharded 27017:27017

# Sau đó connect từ local:
mongosh mongodb://root:mongodb-password@localhost:27017/taskmanagement?authSource=admin
```

### 2. Restart Components

```bash
# Restart mongos
kubectl rollout restart deployment mongodb-sharded-mongos -n mongodb

# Restart một shard (rolling restart)
kubectl rollout restart statefulset mongodb-sharded-shard0-data -n mongodb

# Restart config servers
kubectl rollout restart statefulset mongodb-sharded-configsvr -n mongodb
```

### 3. Scale Components

```bash
# Scale mongos routers
kubectl scale deployment mongodb-sharded-mongos --replicas=3 -n mongodb

# Scale chỉ được với mongos, không scale StatefulSets này được
```

---

## 🎯 Quick Health Check

```bash
# All-in-one health check
echo "=== Pods ==="
kubectl get pods -n mongodb | grep -E "(NAME|Running)"

echo -e "\n=== Shards ==="
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval "sh.status()" | grep -A 10 "^shards"

echo -e "\n=== Data Distribution ==="
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval 'db.getSiblingDB("taskmanagement").tasks.getShardDistribution()'

echo -e "\n=== Total Documents ==="
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval 'print(db.getSiblingDB("taskmanagement").tasks.countDocuments({}))'
```

---

## 🔗 Connection String

### Internal (từ trong cluster)

```
mongodb://root:mongodb-password@mongodb-sharded.mongodb.svc.cluster.local:27017/taskmanagement?authSource=admin
```

### External (port forward)

```
mongodb://root:mongodb-password@localhost:27017/taskmanagement?authSource=admin
```

---

## 📚 Giải thích Key Concepts

### Mongos (Router/Load Balancer)
- Nhận queries từ application
- Route queries đến đúng shard
- Aggregate kết quả từ nhiều shards
- Load balance across shards

### Config Servers
- Lưu metadata của cluster
- Lưu thông tin về chunks
- Lưu shard configuration
- Cần ít nhất 3 để high availability

### Shards
- Lưu trữ data thực tế
- Mỗi shard là một replica set
- Data được phân tán dựa trên shard key
- Horizontal scaling bằng cách thêm shards

### Chunks
- MongoDB chia data thành chunks
- Mỗi chunk thuộc một shard
- Balancer tự động di chuyển chunks
- Default chunk size: 64MB

---

**🎉 MongoDB Sharding hoàn chỉnh với 3 shards, mỗi shard có 3 replicas!**
