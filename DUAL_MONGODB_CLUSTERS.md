# Dual MongoDB Clusters Setup

## ✅ Đã hoàn thành

Đã deploy **2 MongoDB sharded clusters riêng biệt** cho 2 services để scale độc lập.

## 📊 Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     Minikube Cluster                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Namespace: mongodb-user (User Service)                 │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  • user-mongodb-configsvr-0       (Config Server)       │  │
│  │  • user-mongodb-mongos-xxx        (Query Router)        │  │
│  │  • user-mongodb-shard0-data-0     (Data Shard)          │  │
│  │                                                          │  │
│  │  Service: user-mongodb.mongodb-user.svc.cluster.local  │  │
│  │  Port: 27017                                             │  │
│  │  Database: user-service                                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                          ▲                                      │
│                          │                                      │
│                    [User Service]                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Namespace: mongodb-task (Task Service)                 │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  • task-mongodb-configsvr-0       (Config Server)       │  │
│  │  • task-mongodb-mongos-xxx        (Query Router)        │  │
│  │  • task-mongodb-shard0-data-0     (Data Shard)          │  │
│  │                                                          │  │
│  │  Service: task-mongodb.mongodb-task.svc.cluster.local  │  │
│  │  Port: 27017                                             │  │
│  │  Database: task-service                                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                          ▲                                      │
│                          │                                      │
│                    [Task Service]                               │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

## 📁 Terraform Changes

### Module Updates
- ✅ Updated [terraform/modules/platform/mongodb_sharded/variables.tf](terraform/modules/platform/mongodb_sharded/variables.tf)
  - Added `namespace` variable (default: "mongodb-sharded")
  - Added `release_name` variable (default: "mongodb-sharded")

- ✅ Updated [terraform/modules/platform/mongodb_sharded/main.tf](terraform/modules/platform/mongodb_sharded/main.tf)
  - Use `var.namespace` instead of hardcoded "mongodb-sharded"
  - Use `var.release_name` instead of hardcoded "mongodb-sharded"

### Environment Config
- ✅ Updated [terraform/environments/minikube/main.tf](terraform/environments/minikube/main.tf)
  - Renamed `module.mongodb_sharded` → `module.mongodb_user_service`
  - Added `module.mongodb_task_service` (new cluster)

- ✅ Updated [terraform/environments/minikube/outputs.tf](terraform/environments/minikube/outputs.tf)
  - Added `mongodb_user_service` output
  - Added `mongodb_task_service` output
  - Both with connection strings (sensitive)

## 🔗 Connection Strings

### User-Service

**Local (port-forward to 27017):**
```
mongodb://root:MongoDB%40Root2024Secure%21@localhost:27017/user-service?authSource=admin
```

**Kubernetes internal:**
```
mongodb://root:MongoDB%40Root2024Secure%21@user-mongodb.mongodb-user.svc.cluster.local:27017/user-service?authSource=admin
```

### Task-Service

**Local (port-forward to 27018):**
```
mongodb://root:MongoDB%40Root2024Secure%21@localhost:27018/task-service?authSource=admin
```

**Kubernetes internal:**
```
mongodb://root:MongoDB%40Root2024Secure%21@task-mongodb.mongodb-task.svc.cluster.local:27017/task-service?authSource=admin
```

## 🚀 Usage

### Port-Forward Both Clusters

```bash
# Terminal 1: User MongoDB (port 27017)
kubectl port-forward -n mongodb-user svc/user-mongodb 27017:27017

# Terminal 2: Task MongoDB (port 27018)
kubectl port-forward -n mongodb-task svc/task-mongodb 27018:27017

# Terminal 3: User Service
cd service/user-service
npm run start

# Terminal 4: Task Service
cd service/task-service
make run
```

### Check Cluster Status

```bash
# User MongoDB
kubectl get pods -n mongodb-user
kubectl get svc -n mongodb-user

# Task MongoDB
kubectl get pods -n mongodb-task
kubectl get svc -n mongodb-task
```

### Access MongoDB Shell

```bash
# User MongoDB
kubectl exec -it -n mongodb-user user-mongodb-mongodb-sharded-mongos-xxx -- \
  mongosh "mongodb://root:MongoDB%40Root2024Secure%21@localhost:27017/user-service?authSource=admin"

# Task MongoDB
kubectl exec -it -n mongodb-task task-mongodb-mongodb-sharded-mongos-xxx -- \
  mongosh "mongodb://root:MongoDB%40Root2024Secure%21@localhost:27017/task-service?authSource=admin"
```

## 📊 Resource Usage

### Per Cluster (x2)
| Component | CPU Request | Memory Request | CPU Limit | Memory Limit |
|-----------|-------------|----------------|-----------|--------------|
| Config Server | 96m | 192Mi | 256m | 512Mi |
| Mongos Router | 96m | 192Mi | 384m | 768Mi |
| Shard 0 | 192m | 384Mi | 768m | 1536Mi |
| **Total** | **384m** | **768Mi** | **1408m** | **2816Mi** |

### Both Clusters Combined
| Metric | Request | Limit |
|--------|---------|-------|
| CPU | 768m | 2816m |
| Memory | 1536Mi (~1.5Gi) | 5632Mi (~5.5Gi) |

### Minikube Capacity Check
```bash
kubectl top nodes
```

Current usage: **CPU 3% (plenty left!), Memory 30% (plenty left!)**

## 🔧 Scaling

Each cluster can scale independently:

```bash
# Scale user-service MongoDB
cd terraform/environments/minikube
terraform apply -var="mongodb_shards=2" -target=module.mongodb_user_service

# Scale task-service MongoDB
terraform apply -var="mongodb_shards=2" -target=module.mongodb_task_service
```

## 🗑️ Clean Up Old Cluster

The old `mongodb-sharded` cluster in namespace `mongodb-sharded` is no longer needed:

```bash
# Delete old cluster
kubectl delete namespace mongodb-sharded

# Or use Terraform
terraform destroy -target=module.mongodb_sharded  # (if old module still exists)
```

## 🔄 Migration Path

If you have data in the old `mongodb-sharded` cluster, migrate using `mongodump` and `mongorestore`:

```bash
# 1. Dump from old cluster
kubectl exec -n mongodb-sharded mongodb-sharded-mongos-xxx -- \
  mongodump --uri="mongodb://root:password@localhost:27017/user-service?authSource=admin" \
  --out=/tmp/backup

# 2. Restore to new cluster
kubectl exec -n mongodb-user user-mongodb-mongos-xxx -- \
  mongorestore --uri="mongodb://root:password@localhost:27017/user-service?authSource=admin" \
  /tmp/backup/user-service
```

## 📝 Service Configuration Files

### User-Service
- [.env](service/user-service/.env) - Updated to port 27017
- [.env.k8s](service/user-service/.env.k8s) - Kubernetes config

### Task-Service
- [configs/config.yaml](service/task-service/configs/config.yaml) - Updated to port 27018
- [MONGODB_SETUP.md](service/task-service/MONGODB_SETUP.md) - Setup guide

## 🎯 Benefits

✅ **Independent Scaling** - Scale each service's database separately
✅ **Isolation** - Complete namespace and resource isolation
✅ **Fault Tolerance** - One cluster down doesn't affect the other
✅ **Easier Debugging** - Clear separation of concerns
✅ **Production Ready** - Best practice for microservices

## ⚠️ Trade-offs

❌ **More Resources** - 2x the pods (6 total vs 3)
❌ **More Complexity** - 2 clusters to manage
❌ **Higher Costs** - More resource consumption

**Verdict**: Worth it for production workloads where independent scaling is important!

## 📚 References

- MongoDB Sharding: https://www.mongodb.com/docs/manual/sharding/
- Kubernetes Namespaces: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/
- Terraform Module Composition: https://www.terraform.io/docs/language/modules/develop/composition.html
