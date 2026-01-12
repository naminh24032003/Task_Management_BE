#!/bin/bash
# Enable sharding for collections in user-service and task-service databases

set -e

MONGOS_POD="mongodb-sharded-mongos-6dffdc5567-qhjgk"
NAMESPACE="mongodb-sharded"
PASSWORD="MongoDB%40Root2024Secure%21"
URI="mongodb://root:${PASSWORD}@localhost:27017/admin?authSource=admin"

echo "================================================"
echo "  Enable Sharding for Collections"
echo "================================================"
echo ""

# User Service Collections
echo "📦 User Service Collections:"
echo "----------------------------"

kubectl exec -n $NAMESPACE $MONGOS_POD -- mongosh "$URI" --eval "
  // Enable sharding for users collection with userId as shard key
  sh.shardCollection('user-service.users', { userId: 'hashed' });
  print('✅ Sharded user-service.users on { userId: hashed }');
" || echo "⚠️  Collection may not exist yet"

echo ""

# Task Service Collections
echo "📦 Task Service Collections:"
echo "----------------------------"

kubectl exec -n $NAMESPACE $MONGOS_POD -- mongosh "$URI" --eval "
  // Enable sharding for tasks collection with taskId as shard key
  sh.shardCollection('task-service.tasks', { taskId: 'hashed' });
  print('✅ Sharded task-service.tasks on { taskId: hashed }');

  // If you have more collections, add them here:
  // sh.shardCollection('task-service.projects', { projectId: 'hashed' });
" || echo "⚠️  Collection may not exist yet"

echo ""
echo "================================================"
echo "  Sharding Status"
echo "================================================"
kubectl exec -n $NAMESPACE $MONGOS_POD -- mongosh "$URI" --eval "sh.status()" | grep -A 10 "databases"

echo ""
echo "✅ Done! Collections will be sharded when they are created."
