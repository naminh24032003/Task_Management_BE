# 🚀 Redis Cluster Quickstart

Hướng dẫn deploy Redis Cluster trên Minikube và sẵn sàng cho EKS production!

## ✅ Redis đã có gì?

- ✅ **Redis Cluster Mode** - High availability với master/replica
- ✅ **6 nodes minimum** - 3 masters + 3 replicas
- ✅ **Password Authentication** - Bảo mật
- ✅ **Auto Failover** - Tự động chuyển đổi khi node chết
- ✅ **Prometheus Metrics** - Monitoring ready
- ✅ **Production-ready** - Từ Minikube → EKS dễ dàng

---

## 📋 Deploy Redis (3 phút)

### **Bước 1: Enable Redis**

Edit `terraform/environments/minikube/terraform.tfvars`:

```hcl
# Platform Components
redis_enabled = true
redis_persistence_enabled = false  # Dev mode, không cần persistence
```

### **Bước 2: Set Password**

Edit `terraform/environments/minikube/secrets.auto.tfvars`:

```hcl
redis_password = "RedisSecur3P@ssw0rd2024"
```

### **Bước 3: Deploy**

```bash
cd terraform/environments/minikube

# Init (nếu chưa có)
terraform init

# Apply
terraform apply

# Confirm: yes
```

### **Bước 4: Verify**

```bash
# Check pods
kubectl get pods -n redis

# Should see 6 pods:
# redis-cluster-0   1/1   Running
# redis-cluster-1   1/1   Running
# redis-cluster-2   1/1   Running
# redis-cluster-3   1/1   Running
# redis-cluster-4   1/1   Running
# redis-cluster-5   1/1   Running

# Check service
kubectl get svc -n redis
```

---

## 🧪 Test Redis

### **Test 1: Redis CLI**

```bash
# Run Redis client
kubectl run redis-client --rm -ti -n redis \
  --image=bitnami/redis-cluster:latest -- bash

# Inside container - connect to cluster
redis-cli -c -h redis-cluster.redis.svc.cluster.local -a RedisSecur3P@ssw0rd2024

# Test commands
redis-cluster:6379> SET mykey "Hello Redis"
OK

redis-cluster:6379> GET mykey
"Hello Redis"

redis-cluster:6379> INCR counter
(integer) 1

redis-cluster:6379> GET counter
"1"

# Check cluster info
redis-cluster:6379> CLUSTER INFO
cluster_state:ok
cluster_slots_assigned:16384
cluster_slots_ok:16384
cluster_known_nodes:6
cluster_size:3

# Exit
redis-cluster:6379> exit
```

### **Test 2: từ Application**

**Go Example:**
```go
package main

import (
    "github.com/go-redis/redis/v8"
    "context"
)

func main() {
    // Redis Cluster client
    rdb := redis.NewClusterClient(&redis.ClusterOptions{
        Addrs: []string{
            "redis-cluster.redis.svc.cluster.local:6379",
        },
        Password: "RedisSecur3P@ssw0rd2024",
    })

    ctx := context.Background()

    // SET
    err := rdb.Set(ctx, "task:123", "pending", 0).Err()
    if err != nil {
        panic(err)
    }

    // GET
    val, err := rdb.Get(ctx, "task:123").Result()
    if err != nil {
        panic(err)
    }
    fmt.Println("task:123 =", val)
}
```

**Node.js Example:**
```javascript
const Redis = require('ioredis');

const redis = new Redis.Cluster([{
  host: 'redis-cluster.redis.svc.cluster.local',
  port: 6379
}], {
  redisOptions: {
    password: 'RedisSecur3P@ssw0rd2024'
  }
});

// SET
await redis.set('user:456', JSON.stringify({
  name: 'John Doe',
  email: 'john@example.com'
}));

// GET
const user = JSON.parse(await redis.get('user:456'));
console.log(user);

// Hash
await redis.hset('session:789', {
  userId: '456',
  token: 'abc123',
  expiry: Date.now() + 3600000
});

// Increment
await redis.incr('api:requests:count');
```

---

## 🎯 Use Cases

### **1. Session Storage**

```javascript
// Store user session
await redis.setex(`session:${sessionId}`, 3600, JSON.stringify({
  userId: user.id,
  roles: user.roles,
  loginTime: Date.now()
}));

// Get session
const session = JSON.parse(await redis.get(`session:${sessionId}`));

// Delete session (logout)
await redis.del(`session:${sessionId}`);
```

### **2. Caching**

```javascript
// Check cache first
let data = await redis.get('products:list');

if (!data) {
  // Cache miss - fetch from database
  data = await database.getProducts();

  // Store in cache for 5 minutes
  await redis.setex('products:list', 300, JSON.stringify(data));
}

return JSON.parse(data);
```

### **3. Rate Limiting**

```javascript
const key = `ratelimit:${userId}:${endpoint}`;
const limit = 100; // 100 requests
const window = 60; // per minute

const current = await redis.incr(key);

if (current === 1) {
  await redis.expire(key, window);
}

if (current > limit) {
  throw new Error('Rate limit exceeded');
}
```

### **4. Real-time Counters**

```go
// Increment API call counter
redis.Incr(ctx, "api:calls:total")

// Increment per endpoint
redis.Incr(ctx, fmt.Sprintf("api:calls:%s", endpoint))

// Get stats
total, _ := redis.Get(ctx, "api:calls:total").Int64()
```

### **5. Pub/Sub**

```javascript
// Publisher
await redis.publish('notifications', JSON.stringify({
  type: 'task.completed',
  taskId: '123',
  userId: '456'
}));

// Subscriber
redis.subscribe('notifications', (err, count) => {
  console.log(`Subscribed to ${count} channels`);
});

redis.on('message', (channel, message) => {
  const event = JSON.parse(message);
  console.log('Received:', event);
});
```

---

## 📊 Connection Info

### **From Services:**

```bash
# Host
redis-cluster.redis.svc.cluster.local

# Port
6379

# Password
<from secrets.auto.tfvars>

# Connection String
redis-cluster.redis.svc.cluster.local:6379
```

### **Environment Variables:**

```yaml
# Add to service values
microservice:
  envVarsCM:
    REDIS_HOST: redis-cluster.redis.svc.cluster.local
    REDIS_PORT: "6379"
    REDIS_CLUSTER_MODE: "true"

  envVarsSecret:
    REDIS_PASSWORD: RedisSecur3P@ssw0rd2024
```

---

## 🔧 Redis Cluster Architecture

```
┌─────────────────────────────────────────────┐
│         Redis Cluster (6 nodes)             │
├─────────────────────────────────────────────┤
│                                             │
│  Master 1 (slots 0-5460)                   │
│     └─ Replica 4                           │
│                                             │
│  Master 2 (slots 5461-10922)               │
│     └─ Replica 5                           │
│                                             │
│  Master 3 (slots 10923-16383)              │
│     └─ Replica 6                           │
│                                             │
│  • Auto sharding across masters            │
│  • Auto failover if master dies            │
│  • Read from replicas for load balancing   │
└─────────────────────────────────────────────┘
```

**Benefits:**
- ✅ **High Availability** - Replicas take over if master fails
- ✅ **Scalability** - Data sharded across masters
- ✅ **Performance** - Read from replicas
- ✅ **Zero Downtime** - Rolling updates

---

## 🚀 Production (EKS)

Khi deploy lên EKS:

```hcl
# terraform/environments/prod/main.tf
module "redis" {
  source = "../../modules/platform/redis"

  environment = "prod"

  # More nodes for production
  redis_nodes    = 6  # Can scale to 9, 12, etc.
  redis_replicas = 2  # 2 replicas per master

  # More resources
  redis_resources = {
    requests = { cpu = "500m", memory = "1Gi" }
    limits   = { cpu = "1000m", memory = "2Gi" }
  }

  # Enable persistence
  persistence_enabled = true
  persistence_size    = "10Gi"
  storage_class       = "gp3"

  # Production settings
  is_minikube = false
}
```

---

## 📈 Monitoring

Redis metrics exported to Prometheus:

```bash
# Port-forward to access metrics
kubectl port-forward -n redis svc/redis-cluster-metrics 9121:9121

# Metrics endpoint
curl http://localhost:9121/metrics
```

**Key Metrics:**
- `redis_connected_clients` - Active connections
- `redis_used_memory_bytes` - Memory usage
- `redis_commands_processed_total` - Total commands
- `redis_keyspace_hits_total` - Cache hits
- `redis_keyspace_misses_total` - Cache misses

---

## 🔍 Troubleshooting

### **Pods not starting:**
```bash
kubectl describe pod redis-cluster-0 -n redis
kubectl logs redis-cluster-0 -n redis
```

### **Connection refused:**
```bash
# Test from inside cluster
kubectl run test --rm -ti --image=busybox -- sh
nc -zv redis-cluster.redis.svc.cluster.local 6379
```

### **Check cluster status:**
```bash
kubectl exec -it redis-cluster-0 -n redis -- redis-cli -c -a <password> CLUSTER INFO
```

---

## 📚 Useful Commands

```bash
# Get all keys
redis-cli -c -h redis-cluster.redis.svc.cluster.local -a <password> KEYS '*'

# Flush all data (CAREFUL!)
redis-cli -c -h redis-cluster.redis.svc.cluster.local -a <password> FLUSHALL

# Get memory usage
redis-cli -c -h redis-cluster.redis.svc.cluster.local -a <password> INFO memory

# Monitor commands in real-time
redis-cli -c -h redis-cluster.redis.svc.cluster.local -a <password> MONITOR

# Check cluster nodes
redis-cli -c -h redis-cluster.redis.svc.cluster.local -a <password> CLUSTER NODES
```

---

## 🎉 Summary

**✅ Bạn đã có:**
1. Redis Cluster với 6 nodes (HA)
2. Password authentication
3. Auto failover
4. Prometheus metrics
5. Sẵn sàng cho production (EKS)

**🚀 Next Steps:**
1. Tích hợp vào services (session, cache, counters)
2. Monitor metrics trong Grafana
3. Scale up khi cần (9, 12 nodes)
4. Deploy lên EKS với persistence

**Happy Caching!** 🎊
