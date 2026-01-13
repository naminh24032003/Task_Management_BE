# MongoDB Sharding Scripts

Scripts để setup và quản lý MongoDB sharded cluster cho multi-tenant architecture.

## 📁 Files

- `setup-tenant-sharding.js` - Setup zone-based sharding cho 3 tenant (HCM, DN, HN)
- `verify-sharding.js` - Verify sharding configuration
- `add-tenant.js` - Thêm tenant mới vào zone

## 🚀 Usage

### Setup Zone-Based Sharding

Sau khi apply terraform để upgrade từ 1 shard lên 3 shards:

```bash
# Get mongos pod name
MONGOS_POD=$(kubectl get pods -n mongodb-user -l app.kubernetes.io/component=mongos -o jsonpath='{.items[0].metadata.name}')

# Copy script to pod
kubectl cp setup-tenant-sharding.js mongodb-user/$MONGOS_POD:/tmp/

# Run script
kubectl exec -n mongodb-user $MONGOS_POD -- \
  mongosh --quiet \
  -u root \
  -p 'MongoDB@Root2024Secure!' \
  --authenticationDatabase admin \
  /tmp/setup-tenant-sharding.js
```

### Verify Sharding Status

```bash
kubectl exec -n mongodb-user $MONGOS_POD -- \
  mongosh -u root -p 'MongoDB@Root2024Secure!' \
  --authenticationDatabase admin \
  --eval "sh.status()"
```

## 🗺️ Tenant Mapping

| Tenant | Zone | Shard | TenantIds |
|--------|------|-------|-----------|
| HCM (Hồ Chí Minh) | HCM | Shard 0 | hcm, hcm-001, hcm-002, hcm-003 |
| DN (Đà Nẵng) | DN | Shard 1 | dn, dn-001, dn-002, dn-003 |
| HN (Hà Nội) | HN | Shard 2 | hn, hn-001, hn-002, hn-003 |

## 📊 Collections

Các collections được shard với compound key `{ tenantId: 1, _id: 1 }`:

- `users`
- `roles`
- `permissions`
- `tenants` (shard key: `{ tenantId: 1 }`)

## 🔄 Thêm Tenant Mới

Để thêm tenant mới vào một zone, edit `setup-tenant-sharding.js` và thêm vào array:

```javascript
const hcmTenants = ['hcm', 'hcm-001', 'hcm-002', 'hcm-003', 'hcm-NEW'];
```

Sau đó chạy lại script.
