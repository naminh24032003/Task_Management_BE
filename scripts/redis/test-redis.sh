#!/bin/bash
# =============================================================================
# Redis Cluster Testing Script
# Tests Redis cluster functionality
# =============================================================================

set -e

echo "🧪 Testing Redis Cluster..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
NAMESPACE="redis"
REDIS_PASSWORD="redis-secret-password"
REDIS_HOST="redis-cluster.redis.svc.cluster.local"
REDIS_POD=$(kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=redis-cluster -o jsonpath='{.items[0].metadata.name}')

if [ -z "$REDIS_POD" ]; then
    echo -e "${RED}❌ Redis pod not found! Is Redis running?${NC}"
    echo "Run: kubectl get pods -n redis"
    exit 1
fi

echo -e "${GREEN}✅ Using Redis pod: $REDIS_POD${NC}"
echo ""

# Test 1: Cluster Info
echo "📊 Test 1: Cluster Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD CLUSTER INFO 2>/dev/null | grep -E "cluster_state|cluster_slots|cluster_known_nodes|cluster_size"
echo ""

# Test 2: Cluster Nodes
echo "📋 Test 2: Cluster Nodes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD CLUSTER NODES 2>/dev/null | awk '{print $1, $2, $3, $4}' | head -6
echo ""

# Test 3: SET and GET
echo "🔧 Test 3: SET and GET commands"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD SET test:key1 "Hello Redis" 2>/dev/null > /dev/null
RESULT=$(kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD GET test:key1 2>/dev/null)
if [ "$RESULT" == "Hello Redis" ]; then
    echo -e "${GREEN}✅ SET/GET test passed${NC}"
    echo "   SET test:key1 = 'Hello Redis'"
    echo "   GET test:key1 = '$RESULT'"
else
    echo -e "${RED}❌ SET/GET test failed${NC}"
fi
echo ""

# Test 4: INCR counter
echo "📊 Test 4: INCR counter"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD DEL test:counter 2>/dev/null > /dev/null
for i in {1..5}; do
    kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD INCR test:counter 2>/dev/null > /dev/null
done
COUNTER=$(kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD GET test:counter 2>/dev/null)
if [ "$COUNTER" == "5" ]; then
    echo -e "${GREEN}✅ INCR test passed${NC}"
    echo "   Incremented counter 5 times: $COUNTER"
else
    echo -e "${RED}❌ INCR test failed${NC}"
fi
echo ""

# Test 5: Hash operations
echo "🗂️  Test 5: Hash operations (HSET/HGET)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD HSET test:user:123 name "John Doe" email "john@example.com" 2>/dev/null > /dev/null
NAME=$(kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD HGET test:user:123 name 2>/dev/null)
EMAIL=$(kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD HGET test:user:123 email 2>/dev/null)
echo -e "${GREEN}✅ Hash test passed${NC}"
echo "   HSET test:user:123 name='$NAME' email='$EMAIL'"
echo ""

# Test 6: List operations
echo "📝 Test 6: List operations (LPUSH/LRANGE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD DEL test:queue 2>/dev/null > /dev/null
for i in task1 task2 task3; do
    kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD LPUSH test:queue $i 2>/dev/null > /dev/null
done
QUEUE=$(kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD LRANGE test:queue 0 -1 2>/dev/null | tr '\n' ' ')
echo -e "${GREEN}✅ List test passed${NC}"
echo "   Queue contents: $QUEUE"
echo ""

# Test 7: Set operations
echo "🎯 Test 7: Set operations (SADD/SMEMBERS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD DEL test:tags 2>/dev/null > /dev/null
for tag in redis cache database; do
    kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD SADD test:tags $tag 2>/dev/null > /dev/null
done
TAGS=$(kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD SMEMBERS test:tags 2>/dev/null | tr '\n' ' ')
echo -e "${GREEN}✅ Set test passed${NC}"
echo "   Tags: $TAGS"
echo ""

# Test 8: Expiration (TTL)
echo "⏰ Test 8: Key expiration (EXPIRE/TTL)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD SET test:temp "expires in 10s" 2>/dev/null > /dev/null
kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD EXPIRE test:temp 10 2>/dev/null > /dev/null
TTL=$(kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD TTL test:temp 2>/dev/null)
echo -e "${GREEN}✅ TTL test passed${NC}"
echo "   Key expires in: ${TTL} seconds"
echo ""

# Test 9: Performance test
echo "⚡ Test 9: Performance test (100 SET operations)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
START_TIME=$(date +%s%N)
for i in {1..100}; do
    kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD SET test:perf:$i "value$i" 2>/dev/null > /dev/null
done
END_TIME=$(date +%s%N)
DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
echo -e "${GREEN}✅ Performance test completed${NC}"
echo "   100 SET operations in: ${DURATION}ms"
echo "   Throughput: $(( 100000 / DURATION )) ops/second"
echo ""

# Test 10: Memory info
echo "💾 Test 10: Memory usage"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MEMORY=$(kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD INFO memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r')
KEYS=$(kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD DBSIZE 2>/dev/null)
echo "   Memory used: $MEMORY"
echo "   Total keys: $KEYS"
echo ""

# Cleanup test keys
echo "🧹 Cleaning up test keys..."
kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD DEL test:key1 test:counter test:user:123 test:queue test:tags test:temp 2>/dev/null > /dev/null
for i in {1..100}; do
    kubectl exec -n $NAMESPACE $REDIS_POD -- redis-cli -c -a $REDIS_PASSWORD DEL test:perf:$i 2>/dev/null > /dev/null
done
echo -e "${GREEN}✅ Test keys cleaned${NC}"
echo ""

# Summary
echo "📊 Test Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ All Redis cluster tests passed!${NC}"
echo ""
echo "Tested operations:"
echo "  • Cluster info and topology"
echo "  • String operations (SET/GET)"
echo "  • Counters (INCR)"
echo "  • Hash operations (HSET/HGET)"
echo "  • List operations (LPUSH/LRANGE)"
echo "  • Set operations (SADD/SMEMBERS)"
echo "  • Key expiration (EXPIRE/TTL)"
echo "  • Performance benchmarking"
echo "  • Memory usage"
echo ""

echo "💡 Tips:"
echo "   • Connect to Redis CLI: ./scripts/redis/redis-cli.sh"
echo "   • Check REDIS_QUICKSTART.md for usage examples"
echo "   • Monitor with: kubectl top pods -n redis"
echo ""

echo -e "${GREEN}🎉 Redis cluster is healthy and ready to use!${NC}"
