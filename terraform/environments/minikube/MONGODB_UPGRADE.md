# MongoDB Sharding Upgrade Guide

Hướng dẫn upgrade MongoDB User Service từ 1 shard lên 3 shards cho multi-tenant architecture (HCM, DN, HN).

## 📋 Prerequisites

- Terraform đã được init trong `terraform/environments/minikube/`
- Minikube đang chạy
- kubectl có access vào minikube cluster
- MongoDB User Service đã được deploy (namespace: `mongodb-user`)

## 🔍 Check Current Status

```bash
# Check current pods
kubectl get pods -n mongodb-user

# Check current shards (should show 1 shard)
MONGOS_POD=$(kubectl get pods -n mongodb-user -l app.kubernetes.io/component=mongos -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n mongodb-user $MONGOS_POD -- \
  mongosh -u root -p 'MongoDB@Root2024Secure!' \
  --authenticationDatabase admin \
  --eval "sh.status()"
```

## 🚀 Upgrade Steps

### Step 1: Apply Terraform Changes

File `main.tf` đã được update với `mongodb_shards = 3`.

```bash
cd terraform/environments/minikube

# Review changes
terraform plan

# Apply changes
terraform apply

# Wait for new shards to be ready (this may take 5-10 minutes)
kubectl get pods -n mongodb-user -w
```

Sau khi apply, bạn sẽ thấy:
- `user-mongodb-mongodb-sharded-shard0-data-0` (existing)
- `user-mongodb-mongodb-sharded-shard1-data-0` (new)
- `user-mongodb-mongodb-sharded-shard2-data-0` (new)

### Step 2: Verify New Shards

```bash
# Wait for all pods to be Running and Ready
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/component=shardsvr \
  -n mongodb-user \
  --timeout=10m

# Verify shards in MongoDB
kubectl exec -n mongodb-user $MONGOS_POD -- \
  mongosh -u root -p 'MongoDB@Root2024Secure!' \
  --authenticationDatabase admin \
  --eval "sh.status()" | grep "shard"
```

You should see 3 shards:
- `user-mongodb-mongodb-sharded-shard-0`
- `user-mongodb-mongodb-sharded-shard-1`
- `user-mongodb-mongodb-sharded-shard-2`

### Step 3: Setup Zone-Based Sharding

```bash
# Copy setup script to mongos pod
kubectl cp ../../modules/platform/mongodb_sharded/scripts/setup-tenant-sharding.js \
  mongodb-user/$MONGOS_POD:/tmp/setup-tenant-sharding.js

# Run the setup script
kubectl exec -n mongodb-user $MONGOS_POD -- \
  mongosh --quiet \
  -u root \
  -p 'MongoDB@Root2024Secure!' \
  --authenticationDatabase admin \
  /tmp/setup-tenant-sharding.js
```

Script sẽ:
1. ✅ Tag 3 shards với zones (HCM, DN, HN)
2. ✅ Enable sharding trên database `user-service`
3. ✅ Shard các collections (`users`, `roles`, `permissions`, `tenants`)
4. ✅ Configure zone ranges cho mỗi tenant

### Step 4: Verify Zone Configuration

```bash
# Check shard tags
kubectl exec -n mongodb-user $MONGOS_POD -- \
  mongosh -u root -p 'MongoDB@Root2024Secure!' \
  --authenticationDatabase admin \
  --eval "sh.status()" | grep -A 5 "tags"

# Check zone ranges
kubectl exec -n mongodb-user $MONGOS_POD -- \
  mongosh -u root -p 'MongoDB@Root2024Secure!' \
  --authenticationDatabase admin \
  --eval "use config; db.tags.find().pretty()"
```

## 📊 Tenant -> Shard Mapping

| Tenant | Zone | Shard | TenantIds |
|--------|------|-------|-----------|
| **HCM** (Hồ Chí Minh) | HCM | Shard 0 | `hcm`, `hcm-001`, `hcm-002`, `hcm-003` |
| **DN** (Đà Nẵng) | DN | Shard 1 | `dn`, `dn-001`, `dn-002`, `dn-003` |
| **HN** (Hà Nội) | HN | Shard 2 | `hn`, `hn-001`, `hn-002`, `hn-003` |

## 🧪 Test Sharding

```bash
# Connect to mongos
kubectl exec -it -n mongodb-user $MONGOS_POD -- \
  mongosh -u root -p 'MongoDB@Root2024Secure!' --authenticationDatabase admin

# In mongosh, create test data
use user-service

// Insert test users for HCM tenant
db.users.insertOne({
  tenantId: "hcm",
  email: "test@hcm.com",
  status: "active"
})

// Insert test users for DN tenant
db.users.insertOne({
  tenantId: "dn",
  email: "test@dn.com",
  status: "active"
})

// Insert test users for HN tenant
db.users.insertOne({
  tenantId: "hn",
  email: "test@hn.com",
  status: "active"
})

// Check distribution
sh.status()
db.users.getShardDistribution()
```

## ⚠️ Important Notes

1. **Downtime**: Có thể có vài phút downtime khi MongoDB tạo shards mới
2. **Data Migration**: Data hiện có (nếu có) sẽ được tự động balance qua các shards
3. **Connection String**: Connection string không thay đổi, vẫn kết nối qua mongos
4. **Tenant Isolation**: Mỗi tenant's data chỉ nằm trên 1 shard cụ thể

## 🔙 Rollback (If Needed)

Nếu cần rollback về 1 shard:

```bash
cd terraform/environments/minikube

# Edit main.tf: change mongodb_shards from 3 back to 1
# Then apply
terraform apply
```

**Warning**: Rollback sẽ xóa data trên shard 1 và shard 2!

## 📝 Next Steps

1. Update application connection string (if needed)
2. Monitor shard distribution: `sh.status()`
3. Add more tenants to zones as needed
4. Setup monitoring dashboards for shard metrics

## 🆘 Troubleshooting

### Pods không start

```bash
# Check pod logs
kubectl logs -n mongodb-user user-mongodb-mongodb-sharded-shard1-data-0

# Check events
kubectl get events -n mongodb-user --sort-by='.lastTimestamp'
```

### Shards không được thêm vào cluster

```bash
# Manually add shard (if needed)
kubectl exec -n mongodb-user $MONGOS_POD -- \
  mongosh -u root -p 'MongoDB@Root2024Secure!' \
  --authenticationDatabase admin \
  --eval "sh.addShard('user-mongodb-mongodb-sharded-shard-1/user-mongodb-mongodb-sharded-shard1-data-0.user-mongodb-mongodb-sharded-headless.mongodb-user.svc.cluster.local:27017')"
```

### Check resource usage

```bash
kubectl top pods -n mongodb-user
```
