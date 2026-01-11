# MongoDB Sharded Cluster Setup for User Service

## Overview

User Service đã được cấu hình để kết nối tới MongoDB Sharded Cluster trong Minikube với đầy đủ connection pool configuration và các tính năng production-ready.

## Cấu trúc Infrastructure Layer

```
service/user-service/src/infrastructure/
├── config/
│   ├── app.config.ts           # Application configuration
│   └── database.config.ts      # MongoDB connection pool config
├── database/
│   └── mongodb/
│       ├── schemas/
│       │   └── user.schema.ts  # Mongoose User schema với sharding support
│       ├── repositories/
│       │   ├── user-mongodb.repository.ts  # Repository implementation
│       │   └── repositories.module.ts
│       ├── mongodb.module.ts   # MongoDB module với connection pool
│       └── README.md          # Chi tiết về MongoDB configuration
├── health/
│   ├── health.controller.ts   # Health check endpoints
│   └── health.module.ts
├── infrastructure.module.ts   # Main infrastructure module
└── index.ts                   # Exports
```

## Features Đã Được Implement

### 1. Connection Pool Configuration
- **Min Pool Size**: 10 connections
- **Max Pool Size**: 100 connections
- **Socket Timeout**: 45 seconds
- **Server Selection Timeout**: 30 seconds
- **Heartbeat Frequency**: 10 seconds
- **Max Idle Time**: 10 minutes
- **Wait Queue Timeout**: 10 seconds

### 2. Read/Write Concerns
- **Read Preference**: `primaryPreferred` (đọc từ primary, fallback sang secondary)
- **Read Concern**: `majority` (đảm bảo data đã được replicate)
- **Write Concern**: `majority` với journal=true (đảm bảo data durability)

### 3. Retry Logic
- **Retry Writes**: Enabled
- **Retry Reads**: Enabled

### 4. Compression
- Hỗ trợ: `snappy`, `zlib`

### 5. Sharding Support
- User schema có hashed index trên `userId` để hỗ trợ sharding
- Configured để hoạt động với MongoDB Sharded Cluster

### 6. Health Check Endpoints
- `GET /health` - Overall health status
- `GET /health/db` - Database health với connection pool stats
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe

## Environment Variables

File [.env.local](./.env.local) đã được tạo với configuration cho Minikube:

```bash
# MongoDB Connection
MONGODB_URI=mongodb://root:MongoDB@Root2024Secure!@mongodb-sharded.mongodb-sharded.svc.cluster.local:27017/user-service?authSource=admin
MONGODB_DATABASE=user-service

# Connection Pool
MONGODB_POOL_MIN=10
MONGODB_POOL_MAX=100

# Timeouts (milliseconds)
MONGODB_SOCKET_TIMEOUT=45000
MONGODB_SERVER_SELECTION_TIMEOUT=30000
MONGODB_HEARTBEAT_FREQUENCY=10000
MONGODB_MAX_IDLE_TIME=600000
MONGODB_WAIT_QUEUE_TIMEOUT=10000

# Retry Configuration
MONGODB_RETRY_WRITES=true
MONGODB_RETRY_READS=true

# Compression
MONGODB_COMPRESSORS=snappy,zlib

# Read/Write Concerns
MONGODB_READ_PREFERENCE=primaryPreferred
MONGODB_READ_CONCERN=majority
MONGODB_WRITE_CONCERN_W=majority
MONGODB_WRITE_CONCERN_WTIMEOUT=5000
MONGODB_WRITE_CONCERN_JOURNAL=true
```

## Sử Dụng Repository

### Inject Repository vào Service

```typescript
import { Injectable } from '@nestjs/common';
import { UserMongoDbRepository } from './infrastructure';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserMongoDbRepository,
  ) {}

  async createUser(email: string, password: string) {
    return await this.userRepository.create({
      userId: generateUUID(),
      email,
      passwordHash: await hashPassword(password),
      status: 'active',
      isEmailVerified: false,
    });
  }

  async findUserByEmail(email: string) {
    return await this.userRepository.findByEmail(email);
  }

  async listUsers(page: number = 1, limit: number = 10) {
    return await this.userRepository.findMany(
      { deletedAt: null },
      { page, limit, sortBy: 'createdAt', sortOrder: 'desc' }
    );
  }
}
```

### Sử Dụng Transactions

```typescript
// Option 1: Using withTransaction helper
async createUserWithProfile(userData: any) {
  return await this.userRepository.withTransaction(async (session) => {
    const user = await this.userRepository.create(userData, session);
    await this.userRepository.addDomainEvent(
      user.userId,
      'UserCreated',
      { email: user.email },
      session
    );
    return user;
  });
}

// Option 2: Manual control
async updateUserEmail(userId: string, newEmail: string) {
  const session = await this.userRepository.startSession();

  try {
    session.startTransaction();

    const user = await this.userRepository.update(
      userId,
      { email: newEmail },
      session
    );

    await this.userRepository.addDomainEvent(
      userId,
      'EmailChanged',
      { oldEmail: user.email, newEmail },
      session
    );

    await session.commitTransaction();
    return user;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

## Chạy Service

### Local Development

```bash
cd service/user-service

# Install dependencies
npm install

# Start in development mode
npm run dev

# Or with watch mode
npm run start:dev
```

### Production Build

```bash
# Build
npm run build

# Start production
npm run start:prod
```

## Testing MongoDB Connection

### 1. Test từ Local Machine (cần port-forward)

```bash
# Port-forward MongoDB service
kubectl port-forward -n mongodb-sharded svc/mongodb-sharded 27017:27017

# Test connection
npm run dev

# Check health endpoint
curl http://localhost:3001/health/db
```

### 2. Test Health Checks

```bash
# Overall health
curl http://localhost:3001/health

# Database health với pool stats
curl http://localhost:3001/health/db

# Readiness probe
curl http://localhost:3001/health/ready

# Liveness probe
curl http://localhost:3001/health/live
```

Expected response từ `/health/db`:

```json
{
  "status": "healthy",
  "message": "Database is connected and responsive",
  "connection": {
    "host": "mongodb-sharded.mongodb-sharded.svc.cluster.local",
    "port": 27017,
    "database": "user-service",
    "readyState": 1
  },
  "pool": {
    "availableConnections": 95,
    "totalConnections": 100,
    "pendingOperations": 0
  },
  "timestamp": "2025-01-11T10:30:00.000Z"
}
```

## Enable Sharding cho Users Collection

Sau khi service chạy và tạo collection, enable sharding:

```bash
# Exec vào mongos pod
kubectl exec -n mongodb-sharded mongodb-sharded-mongos-xxx -it -- bash

# Connect to MongoDB
mongosh "mongodb://root:MongoDB@Root2024Secure!@localhost:27017/admin?authSource=admin"

# Enable sharding on database
sh.enableSharding("user-service")

# Shard the users collection using hashed sharding on userId
sh.shardCollection("user-service.users", { userId: "hashed" })

# Check sharding status
sh.status()
```

## Troubleshooting

### Connection Timeout

```bash
# Check MongoDB pods
kubectl get pods -n mongodb-sharded

# Check MongoDB service
kubectl get svc -n mongodb-sharded

# Check logs
kubectl logs -n mongodb-sharded mongodb-sharded-mongos-xxx
```

### Test Connection từ trong Cluster

```bash
kubectl run -n default mongodb-test --rm -it --image=mongo:8.0 -- \
  mongosh "mongodb://root:MongoDB@Root2024Secure!@mongodb-sharded.mongodb-sharded.svc.cluster.local:27017/admin?authSource=admin"
```

### Monitor Connection Pool

```bash
# Watch health endpoint
watch -n 1 'curl -s http://localhost:3001/health/db | jq .pool'
```

## Repository API Reference

### Create Operations
- `create(userData, session?)` - Tạo user mới

### Read Operations
- `findById(userId)` - Tìm user theo ID
- `findByEmail(email)` - Tìm user theo email
- `findOne(filter)` - Tìm 1 user với filter
- `findMany(filter, options)` - Tìm nhiều users với pagination
- `exists(filter)` - Check user tồn tại
- `count(filter)` - Đếm số users

### Update Operations
- `update(userId, updateData, session?)` - Update user
- `updateLastLogin(userId)` - Update last login time
- `verifyEmail(userId)` - Mark email as verified

### Delete Operations
- `delete(userId, session?)` - Hard delete
- `softDelete(userId, session?)` - Soft delete

### Transaction Operations
- `startSession()` - Start new session
- `withTransaction(callback)` - Execute trong transaction

### Domain Events
- `addDomainEvent(userId, eventType, eventData)` - Add domain event
- `clearDomainEvents(userId)` - Clear domain events

## Best Practices

1. **Luôn sử dụng transactions** cho operations cần consistency
2. **Sử dụng soft delete** thay vì hard delete trong production
3. **Monitor connection pool** qua health check endpoints
4. **Index properly** - schema đã có các indexes cơ bản
5. **Handle errors gracefully** - retry logic đã được enable
6. **Use pagination** khi query nhiều records
7. **Clear domain events** sau khi publish để tránh memory leak

## Files Created

- ✅ [src/infrastructure/config/database.config.ts](./src/infrastructure/config/database.config.ts)
- ✅ [src/infrastructure/config/app.config.ts](./src/infrastructure/config/app.config.ts)
- ✅ [src/infrastructure/database/mongodb/mongodb.module.ts](./src/infrastructure/database/mongodb/mongodb.module.ts)
- ✅ [src/infrastructure/database/mongodb/schemas/user.schema.ts](./src/infrastructure/database/mongodb/schemas/user.schema.ts)
- ✅ [src/infrastructure/database/mongodb/repositories/user-mongodb.repository.ts](./src/infrastructure/database/mongodb/repositories/user-mongodb.repository.ts)
- ✅ [src/infrastructure/database/mongodb/repositories/repositories.module.ts](./src/infrastructure/database/mongodb/repositories/repositories.module.ts)
- ✅ [src/infrastructure/database/mongodb/README.md](./src/infrastructure/database/mongodb/README.md)
- ✅ [src/infrastructure/health/health.controller.ts](./src/infrastructure/health/health.controller.ts)
- ✅ [src/infrastructure/health/health.module.ts](./src/infrastructure/health/health.module.ts)
- ✅ [src/infrastructure/infrastructure.module.ts](./src/infrastructure/infrastructure.module.ts)
- ✅ [src/infrastructure/index.ts](./src/infrastructure/index.ts)
- ✅ [.env.local](./.env.local) - MongoDB credentials for Minikube
- ✅ [.env.example](./.env.example) - Example environment variables

## Next Steps

1. ✅ MongoDB connection đã được cấu hình
2. ✅ Infrastructure layer đã được tạo
3. ✅ Repository implementation đã sẵn sàng
4. ⏭️ Implement application services sử dụng repository
5. ⏭️ Implement domain logic trong aggregates
6. ⏭️ Test toàn bộ flow
7. ⏭️ Deploy service vào Kubernetes
8. ⏭️ Enable sharding cho users collection

## Support

Xem chi tiết trong:
- [MongoDB Configuration README](./src/infrastructure/database/mongodb/README.md)
- [NestJS Mongoose Documentation](https://docs.nestjs.com/techniques/mongodb)
- [MongoDB Sharding Guide](https://www.mongodb.com/docs/manual/sharding/)
