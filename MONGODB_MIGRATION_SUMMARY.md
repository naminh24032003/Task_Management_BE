# MongoDB Migration Summary

## ✅ Đã hoàn thành

### 1. MongoDB Sharded Cluster
- **Status**: ✅ Running trong Minikube
- **Pods**: 3 pods (configsvr, mongos, shard0-data)
- **Resources Used**: 86m CPU, 693Mi Memory
- **Available**: 97% CPU, 70% Memory còn dư

### 2. Databases Created
| Database | Status | Sharding | Primary Shard |
|----------|--------|----------|---------------|
| user-service | ✅ Created | Enabled | mongodb-sharded-shard-0 |
| task-service | ✅ Created | Enabled | mongodb-sharded-shard-0 |

### 3. User-Service (NestJS)
- ✅ MongoDB config done
- ✅ Connection pool configured
- ✅ `readConcern` fixed (object format)
- ✅ Password URL encoded
- ✅ Proto files synced (user + google API)
- ✅ Ready to run

**Config**: [service/user-service/.env](service/user-service/.env)

### 4. Task-Service (Golang)
- ✅ MongoDB driver installed (`go.mongodb.org/mongo-driver v1.17.6`)
- ✅ MongoDB repository implementation created
- ✅ Config updated to MongoDB
- ✅ Connection helper created
- ✅ MySQL config removed
- ✅ Ready to run

**Config**: [service/task-service/configs/config.yaml](service/task-service/configs/config.yaml)

---

## 📁 Files Created/Modified

### User-Service
| File | Type | Description |
|------|------|-------------|
| `.env` | Modified | MongoDB connection config |
| `.env.k8s` | New | K8s environment config |
| `.env.README.md` | New | Environment guide |
| `src/infrastructure/config/database.config.ts` | Modified | Fixed readConcern format |
| `scripts/sync-proto.cmd` | Modified | Added google proto sync |
| `scripts/sync-proto.sh` | Modified | Added google proto sync |
| `start-dev.ps1` | New | Auto-start script (Windows) |
| `start-dev.sh` | New | Auto-start script (Linux/Mac) |

### Task-Service
| File | Type | Description |
|------|------|-------------|
| `internal/adapter/persistence/mongodb/mongodb.go` | New | MongoDB connection manager |
| `internal/adapter/persistence/mongodb/task_repo.go` | New | MongoDB repository |
| `configs/config.yaml` | Modified | MongoDB configuration |
| `go.mod` | Modified | Added MongoDB driver |
| `setup-mongodb.sh` | New | Setup script (Linux/Mac) |
| `setup-mongodb.ps1` | New | Setup script (Windows) |
| `MONGODB_SETUP.md` | New | MongoDB setup guide |

### Scripts
| File | Description |
|------|-------------|
| `scripts/enable-sharding-collections.sh` | Enable sharding for collections |
| `scripts/enable-sharding-collections.ps1` | Enable sharding (PowerShell) |
| `scripts/encode-mongodb-password.sh` | URL encode MongoDB password |
| `scripts/encode-mongodb-password.ps1` | URL encode password (PowerShell) |

---

## 🚀 How to Run

### Prerequisites
```bash
# Start MongoDB port-forward (Terminal 1)
kubectl port-forward -n mongodb-sharded svc/mongodb-sharded 27017:27017
```

### User-Service (NestJS)

**Option 1: Auto-start (Recommended)**
```powershell
cd service\user-service
.\start-dev.ps1
```

**Option 2: Manual**
```bash
cd service/user-service
npm run proto:sync
npm run start
```

### Task-Service (Golang)

```bash
cd service/task-service
make run
# or
go run cmd/task-service/main.go -conf configs/config.yaml
```

---

## 📊 MongoDB Status

### Connection Strings

**User-Service (Local)**
```
mongodb://root:MongoDB%40Root2024Secure%21@localhost:27017/user-service?authSource=admin
```

**Task-Service (Local)**
```
mongodb://root:MongoDB%40Root2024Secure%21@localhost:27017/task-service?authSource=admin
```

**Kubernetes (Internal)**
```
mongodb://root:MongoDB%40Root2024Secure%21@mongodb-sharded.mongodb-sharded.svc.cluster.local:27017/[DB_NAME]?authSource=admin
```

### Check MongoDB Status

```bash
# List databases
kubectl exec -n mongodb-sharded mongodb-sharded-mongos-xxx -- \
  mongosh "mongodb://root:MongoDB%40Root2024Secure%21@localhost:27017/admin?authSource=admin" \
  --eval "db.adminCommand('listDatabases')"

# Check sharding status
kubectl exec -n mongodb-sharded mongodb-sharded-mongos-xxx -- \
  mongosh "mongodb://root:MongoDB%40Root2024Secure%21@localhost:27017/admin?authSource=admin" \
  --eval "sh.status()"
```

---

## 🔧 Next Steps

### 1. Enable Collection Sharding (Optional)

Once services create collections:

```bash
./scripts/enable-sharding-collections.sh
# or
.\scripts\enable-sharding-collections.ps1
```

This will shard:
- `user-service.users` on `{ userId: "hashed" }`
- `task-service.tasks` on `{ taskId: "hashed" }`

### 2. Test Services

**User-Service:**
```bash
# Health check
curl http://localhost:9090/metrics

# gRPC endpoint
grpcurl -plaintext localhost:50051 list
```

**Task-Service:**
```bash
# Health check
curl http://localhost:9091/health

# gRPC endpoint
grpcurl -plaintext localhost:50052 list
```

### 3. Deploy to Kubernetes

Update ConfigMaps/Secrets with MongoDB connection strings for K8s internal network.

---

## 📝 Key Configuration Points

### Password URL Encoding
Always URL encode MongoDB password:
- Original: `MongoDB@Root2024Secure!`
- Encoded: `MongoDB%40Root2024Secure%21`

Use helper scripts:
```bash
./scripts/encode-mongodb-password.sh
```

### Read/Write Concerns

Both services configured with:
- **Read Preference**: `primaryPreferred`
- **Read Concern**: `majority`
- **Write Concern**: `majority` with journal

### Connection Pool

Both services:
- Min Pool Size: 10
- Max Pool Size: 100

---

## 🎯 Summary

✅ **2 Services** → Both using MongoDB
✅ **2 Databases** → Isolated and sharded
✅ **Minikube** → Plenty of resources available
✅ **No Migration Needed** → Fresh setup, no data
✅ **Ready to Run** → All configs done

**Estimated Setup Time**: 5 minutes
**Resource Impact**: Minimal (plenty of headroom)

---

## 📚 Documentation

- User-Service MongoDB Config: [service/user-service/.env.README.md](service/user-service/.env.README.md)
- Task-Service MongoDB Setup: [service/task-service/MONGODB_SETUP.md](service/task-service/MONGODB_SETUP.md)
- MongoDB Sharding Guide: Check `sh.status()` in MongoDB shell

---

## 🆘 Troubleshooting

See individual service documentation:
- User-Service: [.env.README.md](service/user-service/.env.README.md)
- Task-Service: [MONGODB_SETUP.md](service/task-service/MONGODB_SETUP.md)

Or check MongoDB connection:
```bash
kubectl get pods -n mongodb-sharded
kubectl logs -n mongodb-sharded mongodb-sharded-mongos-xxx
```
