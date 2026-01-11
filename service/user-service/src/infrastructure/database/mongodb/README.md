# MongoDB Configuration

This directory contains MongoDB database configuration and implementations for the User Service.

## Features

- **MongoDB Sharded Cluster Support**: Configured to work with MongoDB sharded clusters in Kubernetes/Minikube
- **Connection Pool Management**: Fully configured connection pool with min/max connections, timeouts, and retry logic
- **Read/Write Concerns**: Production-ready read and write concern configurations for data consistency
- **Compression**: Supports snappy and zlib compression for network traffic
- **Health Checks**: Built-in health check endpoints for monitoring database connectivity

## Directory Structure

```
mongodb/
├── schemas/           # Mongoose schemas
│   └── user.schema.ts
├── repositories/      # Repository implementations
│   ├── user-mongodb.repository.ts
│   └── repositories.module.ts
├── mongodb.module.ts  # MongoDB module with connection pool config
└── README.md
```

## Connection Pool Configuration

The connection pool is configured with the following parameters (can be overridden via environment variables):

- **Min Pool Size**: 10 connections (minimum connections maintained)
- **Max Pool Size**: 100 connections (maximum connections allowed)
- **Socket Timeout**: 45 seconds
- **Server Selection Timeout**: 30 seconds
- **Heartbeat Frequency**: 10 seconds
- **Max Idle Time**: 10 minutes (connections idle for this duration will be closed)
- **Wait Queue Timeout**: 10 seconds

## Environment Variables

See `.env.example` for all available MongoDB configuration options:

```bash
# Required
MONGODB_URI=mongodb://root:password@mongodb-sharded.mongodb-sharded.svc.cluster.local:27017/user-service?authSource=admin
MONGODB_DATABASE=user-service

# Connection Pool (Optional - defaults provided)
MONGODB_POOL_MIN=10
MONGODB_POOL_MAX=100

# Timeouts (Optional)
MONGODB_SOCKET_TIMEOUT=45000
MONGODB_SERVER_SELECTION_TIMEOUT=30000
MONGODB_HEARTBEAT_FREQUENCY=10000
MONGODB_MAX_IDLE_TIME=600000
MONGODB_WAIT_QUEUE_TIMEOUT=10000

# Retry Configuration (Optional)
MONGODB_RETRY_WRITES=true
MONGODB_RETRY_READS=true

# Compression (Optional)
MONGODB_COMPRESSORS=snappy,zlib

# Read/Write Concerns (Optional)
MONGODB_READ_PREFERENCE=primaryPreferred
MONGODB_READ_CONCERN=majority
MONGODB_WRITE_CONCERN_W=majority
MONGODB_WRITE_CONCERN_WTIMEOUT=5000
MONGODB_WRITE_CONCERN_JOURNAL=true
```

## Usage

### Injecting the Repository

```typescript
import { Injectable } from '@nestjs/common';
import { UserMongoDbRepository } from './infrastructure/database/mongodb/repositories/user-mongodb.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserMongoDbRepository,
  ) {}

  async createUser(email: string, password: string) {
    return await this.userRepository.create({
      userId: generateId(),
      email,
      passwordHash: await hash(password),
    });
  }

  async findUserByEmail(email: string) {
    return await this.userRepository.findByEmail(email);
  }
}
```

### Using Transactions

The repository provides built-in transaction support:

```typescript
// Method 1: Using withTransaction helper
await this.userRepository.withTransaction(async (session) => {
  const user = await this.userRepository.create(userData, session);
  await this.userRepository.addDomainEvent(
    user.userId,
    'UserCreated',
    { email: user.email },
  );
  return user;
});

// Method 2: Manual transaction control
const session = await this.userRepository.startSession();
try {
  session.startTransaction();

  const user = await this.userRepository.create(userData, session);
  // ... other operations

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

## Health Checks

The service provides the following health check endpoints:

- `GET /health` - Overall health status
- `GET /health/db` - Detailed database health with connection pool stats
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe

Example response from `GET /health/db`:

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

## Sharding Configuration

The User schema is configured to support MongoDB sharding with a hashed index on `userId`:

```typescript
UserSchema.index({ userId: 'hashed' }); // Hashed sharding for even distribution
```

To enable sharding on the collection in MongoDB:

```bash
# Connect to mongos
kubectl exec -n mongodb-sharded mongodb-sharded-mongos-xxx -- mongosh "mongodb://root:password@localhost:27017/admin?authSource=admin"

# Enable sharding on database
sh.enableSharding("user-service")

# Shard the users collection
sh.shardCollection("user-service.users", { userId: "hashed" })
```

## Best Practices

1. **Connection Reuse**: Always reuse connections from the pool. Don't create new connections for each request.

2. **Indexing**: Ensure proper indexes are created for your query patterns. The schema includes common indexes.

3. **Write Concerns**: Use `majority` write concern for critical data to ensure data durability.

4. **Read Preference**: Use `primaryPreferred` for read-heavy workloads to distribute reads to secondaries when available.

5. **Transactions**: Only use transactions when necessary, as they have performance overhead.

6. **Monitoring**: Monitor connection pool metrics using the health check endpoints.

## Troubleshooting

### Connection Issues

If you see connection timeout errors:

1. Check if MongoDB pods are running: `kubectl get pods -n mongodb-sharded`
2. Verify the MongoDB service: `kubectl get svc -n mongodb-sharded`
3. Test connectivity from within the cluster: `kubectl run -n default mongodb-test --rm -it --image=mongo:8.0 -- mongosh "mongodb://root:password@mongodb-sharded.mongodb-sharded.svc.cluster.local:27017/admin?authSource=admin"`

### Pool Exhaustion

If you see "waiting for connection" errors:

1. Increase `MONGODB_POOL_MAX`
2. Check for connection leaks (ensure sessions are properly closed)
3. Review slow queries that might be holding connections

### Performance Issues

1. Enable query profiling: `db.setProfilingLevel(1, { slowms: 100 })`
2. Analyze slow queries: `db.system.profile.find().sort({ ts: -1 }).limit(10)`
3. Review and optimize indexes
4. Consider increasing pool size for high-concurrency scenarios
