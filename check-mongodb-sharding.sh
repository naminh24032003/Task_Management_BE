#!/bin/bash

# MongoDB Sharding Check Script
# Usage: ./check-mongodb-sharding.sh

echo "=========================================="
echo "   MongoDB Sharding Health Check"
echo "=========================================="

# Get mongos pod name dynamically
MONGOS_POD=$(kubectl get pods -n mongodb -l app.kubernetes.io/component=mongos -o jsonpath='{.items[0].metadata.name}')

if [ -z "$MONGOS_POD" ]; then
    echo "❌ Error: No mongos pod found!"
    exit 1
fi

echo "Using mongos pod: $MONGOS_POD"
echo ""

# 1. Check all pods
echo "1️⃣  === Pods Status ==="
kubectl get pods -n mongodb | grep -E "(NAME|shard|mongos|configsvr)"
echo ""

# 2. Check StatefulSets
echo "2️⃣  === StatefulSets ==="
kubectl get statefulsets -n mongodb
echo ""

# 3. Check Shards
echo "3️⃣  === Shards Configuration ==="
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval "sh.status()" | grep -A 10 "^shards"
echo ""

# 4. Check Data Distribution
echo "4️⃣  === Data Distribution Across Shards ==="
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval 'db.getSiblingDB("taskmanagement").tasks.getShardDistribution()'
echo ""

# 5. Check Replica Sets
echo "5️⃣  === Replica Set Status (Shard 0) ==="
kubectl exec mongodb-sharded-shard0-data-0 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval "rs.status()" | grep -E "(name|stateStr)" | head -10
echo ""

echo "6️⃣  === Replica Set Status (Shard 1) ==="
kubectl exec mongodb-sharded-shard1-data-0 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval "rs.status()" | grep -E "(name|stateStr)" | head -10
echo ""

echo "7️⃣  === Replica Set Status (Shard 2) ==="
kubectl exec mongodb-sharded-shard2-data-0 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval "rs.status()" | grep -E "(name|stateStr)" | head -10
echo ""

# 6. Check Config Server
echo "8️⃣  === Config Server Replica Set ==="
kubectl exec mongodb-sharded-configsvr-0 -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval "rs.status()" | grep -E "(name|stateStr)" | head -10
echo ""

# 7. Document Count
echo "9️⃣  === Document Count ==="
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval 'print("Total tasks:", db.getSiblingDB("taskmanagement").tasks.countDocuments({}))'
echo ""

# 8. Chunk Distribution
echo "🔟 === Chunk Distribution ==="
kubectl exec $MONGOS_POD -n mongodb -- mongosh -u root -p mongodb-password --authenticationDatabase admin --quiet --eval "sh.status()" | grep -A 15 "taskmanagement.tasks" | grep -E "(chunkMetadata|chunks)"
echo ""

echo "=========================================="
echo "   ✅ Health Check Complete!"
echo "=========================================="