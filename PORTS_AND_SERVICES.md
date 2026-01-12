# MongoDB Clusters - Ports & Services Reference

## ✅ Port-Forward Commands (CORRECT)

### User Service MongoDB
```bash
kubectl port-forward -n mongodb-user svc/user-mongodb-mongodb-sharded 27017:27017
```

### Task Service MongoDB
```bash
kubectl port-forward -n mongodb-task svc/task-mongodb-mongodb-sharded 27018:27017
```

---

## 📊 Service Names

| Cluster | Namespace | Service Name | Port |
|---------|-----------|--------------|------|
| User MongoDB | `mongodb-user` | `user-mongodb-mongodb-sharded` | 27017 |
| Task MongoDB | `mongodb-task` | `task-mongodb-mongodb-sharded` | 27017 |

---

## 🔗 Connection Strings

### User Service (Local)
```
mongodb://root:MongoDB%40Root2024Secure%21@localhost:27017/user-service?authSource=admin
```

### Task Service (Local)
```
mongodb://root:MongoDB%40Root2024Secure%21@localhost:27018/task-service?authSource=admin
```

---

## 🚀 Quick Start

```bash
# Terminal 1
kubectl port-forward -n mongodb-user svc/user-mongodb-mongodb-sharded 27017:27017

# Terminal 2
kubectl port-forward -n mongodb-task svc/task-mongodb-mongodb-sharded 27018:27017

# Terminal 3
cd service/user-service && npm run start

# Terminal 4
cd service/task-service && make run
```

---

## 🔍 Verify Connection

```bash
# Test User MongoDB
mongosh "mongodb://root:MongoDB%40Root2024Secure%21@localhost:27017/admin?authSource=admin" --eval "db.version()"

# Test Task MongoDB
mongosh "mongodb://root:MongoDB%40Root2024Secure%21@localhost:27018/admin?authSource=admin" --eval "db.version()"
```

---

## 📝 Helper Scripts

```bash
# Port-forward (interactive)
./scripts/port-forward-mongodb-correct.sh

# Test connections
./scripts/test-mongodb-connections.sh
```
