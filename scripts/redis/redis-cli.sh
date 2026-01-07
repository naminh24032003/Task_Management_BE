#!/bin/bash
# =============================================================================
# Redis CLI Connection Script
# Quick access to Redis cluster CLI
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

NAMESPACE="redis"
REDIS_PASSWORD="redis-secret-password"

echo "🔌 Connecting to Redis Cluster..."
echo ""

# Check if Redis is running
REDIS_POD=$(kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=redis-cluster -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$REDIS_POD" ]; then
    echo -e "${RED}❌ Redis cluster not found!${NC}"
    echo "Is Redis running? Check with: kubectl get pods -n redis"
    exit 1
fi

echo -e "${GREEN}✅ Connected to pod: $REDIS_POD${NC}"
echo ""
echo "📝 Redis CLI Commands you can try:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CLUSTER INFO          - Show cluster information"
echo "  CLUSTER NODES         - List all nodes"
echo "  SET key value         - Set a key"
echo "  GET key               - Get a key"
echo "  INCR counter          - Increment counter"
echo "  HSET hash field val   - Set hash field"
echo "  HGET hash field       - Get hash field"
echo "  LPUSH list item       - Add to list"
echo "  LRANGE list 0 -1      - Get all list items"
echo "  KEYS *                - List all keys (use carefully!)"
echo "  INFO                  - Server information"
echo "  exit                  - Exit CLI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Starting Redis CLI...${NC}"
echo ""

# Connect to Redis CLI
kubectl exec -it -n $NAMESPACE $REDIS_POD -- redis-cli -c -h redis-cluster.redis.svc.cluster.local -a $REDIS_PASSWORD

echo ""
echo -e "${GREEN}✅ Disconnected from Redis${NC}"
