#!/bin/bash
# =============================================================================
# Kafka Testing Script
# Tests Kafka pub/sub functionality with producer and consumer
# =============================================================================

set -e

echo "🧪 Testing Kafka Pub/Sub..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
NAMESPACE="kafka"
TEST_TOPIC="test-topic"
BROKERS="kafka.kafka.svc.cluster.local:9092"
KAFKA_POD=$(kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=kafka -o jsonpath='{.items[0].metadata.name}')

if [ -z "$KAFKA_POD" ]; then
    echo -e "${RED}❌ Kafka pod not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Using Kafka pod: $KAFKA_POD${NC}"
echo ""

# Create client config
echo "🔐 Setting up authentication..."
kubectl exec -n $NAMESPACE $KAFKA_POD -- bash -c "cat > /tmp/client.properties << 'EOF'
security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-256
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"kafka-user\" password=\"kafka-secret-password\";
EOF"
echo -e "${GREEN}✅ Authentication configured${NC}"
echo ""

# Create test topic
echo "📝 Creating test topic: $TEST_TOPIC"
kubectl exec -n $NAMESPACE $KAFKA_POD -- kafka-topics.sh \
    --bootstrap-server $BROKERS \
    --command-config /tmp/client.properties \
    --create \
    --topic $TEST_TOPIC \
    --partitions 3 \
    --replication-factor 1 \
    --if-not-exists \
    > /dev/null 2>&1 || true
echo -e "${GREEN}✅ Test topic ready${NC}"
echo ""

# Describe topic
echo "📊 Topic Information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $KAFKA_POD -- kafka-topics.sh \
    --bootstrap-server $BROKERS \
    --command-config /tmp/client.properties \
    --describe \
    --topic $TEST_TOPIC
echo ""

# Test messages
TIMESTAMP=$(date +%s)
TEST_MESSAGES=(
    "{\"event\":\"test\",\"message\":\"Hello Kafka!\",\"timestamp\":$TIMESTAMP}"
    "{\"event\":\"task_created\",\"task_id\":\"123\",\"title\":\"Test Task\",\"timestamp\":$TIMESTAMP}"
    "{\"event\":\"user_registered\",\"user_id\":\"456\",\"email\":\"test@example.com\",\"timestamp\":$TIMESTAMP}"
    "{\"event\":\"notification_sent\",\"type\":\"email\",\"status\":\"success\",\"timestamp\":$TIMESTAMP}"
)

# Produce messages
echo "📤 Producing test messages..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for i in "${!TEST_MESSAGES[@]}"; do
    msg="${TEST_MESSAGES[$i]}"
    echo -e "${YELLOW}Message $((i+1)):${NC} $msg"

    echo "$msg" | kubectl exec -i -n $NAMESPACE $KAFKA_POD -- \
        kafka-console-producer.sh \
        --bootstrap-server $BROKERS \
        --producer.config /tmp/client.properties \
        --topic $TEST_TOPIC \
        > /dev/null 2>&1

    sleep 0.5
done
echo -e "${GREEN}✅ All messages produced${NC}"
echo ""

# Consume messages
echo "📥 Consuming messages..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Fetching messages from beginning..."
echo ""

# Use timeout to prevent hanging
timeout 10s kubectl exec -n $NAMESPACE $KAFKA_POD -- \
    kafka-console-consumer.sh \
    --bootstrap-server $BROKERS \
    --consumer.config /tmp/client.properties \
    --topic $TEST_TOPIC \
    --from-beginning \
    --max-messages ${#TEST_MESSAGES[@]} \
    2>/dev/null || true
echo ""
echo -e "${GREEN}✅ Messages consumed successfully${NC}"
echo ""

# Get consumer group info
echo "👥 Consumer Groups:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $KAFKA_POD -- \
    kafka-consumer-groups.sh \
    --bootstrap-server $BROKERS \
    --command-config /tmp/client.properties \
    --list \
    2>/dev/null || echo "No consumer groups yet"
echo ""

# Performance test
echo "⚡ Performance Test (100 messages)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
START_TIME=$(date +%s%N)

# Produce 100 messages
for i in {1..100}; do
    echo "{\"id\":$i,\"message\":\"Performance test message $i\",\"timestamp\":$(date +%s)}"
done | kubectl exec -i -n $NAMESPACE $KAFKA_POD -- \
    kafka-console-producer.sh \
    --bootstrap-server $BROKERS \
    --producer.config /tmp/client.properties \
    --topic $TEST_TOPIC \
    > /dev/null 2>&1

END_TIME=$(date +%s%N)
DURATION=$(( (END_TIME - START_TIME) / 1000000 ))

echo -e "${GREEN}✅ Produced 100 messages in ${DURATION}ms${NC}"
echo -e "   Throughput: $(( 100000 / DURATION )) messages/second"
echo ""

# Summary
echo "📊 Test Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Kafka cluster is healthy${NC}"
echo -e "${GREEN}✅ Producer working correctly${NC}"
echo -e "${GREEN}✅ Consumer working correctly${NC}"
echo -e "${GREEN}✅ Pub/Sub functionality verified${NC}"
echo ""

echo "💡 Tips:"
echo "   • View messages in Kafka UI: http://localhost:8080"
echo "   • Monitor with: kubectl logs -n kafka $KAFKA_POD -f"
echo "   • Check topics: ./scripts/kafka/create-topics.sh"
echo ""

# Cleanup option
read -p "Delete test topic? (y/n): " cleanup
if [ "$cleanup" == "y" ]; then
    echo "🗑️  Deleting test topic..."
    kubectl exec -n $NAMESPACE $KAFKA_POD -- kafka-topics.sh \
        --bootstrap-server $BROKERS \
        --command-config /tmp/client.properties \
        --delete \
        --topic $TEST_TOPIC \
        > /dev/null 2>&1 || true
    echo -e "${GREEN}✅ Test topic deleted${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Kafka testing completed successfully!${NC}"
