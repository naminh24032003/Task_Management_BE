#!/bin/bash
# =============================================================================
# Kafka Topics Creation Script
# Creates standard topics for the microservices architecture
# =============================================================================

set -e

echo "📋 Creating Kafka Topics..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
NAMESPACE="kafka"
KAFKA_POD=$(kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=kafka -o jsonpath='{.items[0].metadata.name}')
BROKERS="kafka.kafka.svc.cluster.local:9092"

if [ -z "$KAFKA_POD" ]; then
    echo -e "${RED}❌ Kafka pod not found! Is Kafka running?${NC}"
    echo "Run: kubectl get pods -n kafka"
    exit 1
fi

echo -e "${GREEN}✅ Found Kafka pod: $KAFKA_POD${NC}"
echo ""

# Create client config
echo "🔐 Creating Kafka client configuration..."
kubectl exec -n $NAMESPACE $KAFKA_POD -- bash -c "cat > /tmp/client.properties << 'EOF'
security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-256
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"kafka-user\" password=\"kafka-secret-password\";
EOF"
echo -e "${GREEN}✅ Client config created${NC}"
echo ""

# Define topics
# Format: topic_name:partitions:replication_factor:retention_ms:description
declare -a TOPICS=(
    "tasks:3:1:604800000:Task events (create, update, delete)"
    "users:3:1:604800000:User events (register, update, delete)"
    "notifications:3:1:259200000:Notification messages"
    "audit-logs:5:1:2592000000:System audit logs (30 days retention)"
    "events:5:1:604800000:Generic application events"
    "task-assignments:3:1:604800000:Task assignment events"
    "user-activities:3:1:604800000:User activity tracking"
    "system-metrics:3:1:86400000:System metrics (1 day retention)"
    "dead-letter-queue:3:1:2592000000:Failed message queue"
)

echo "📝 Topics to create:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for topic_config in "${TOPICS[@]}"; do
    IFS=':' read -r topic partitions replication retention description <<< "$topic_config"
    printf "%-25s %s\n" "$topic" "$description"
done
echo ""

# Create topics
echo "🚀 Creating topics..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for topic_config in "${TOPICS[@]}"; do
    IFS=':' read -r topic partitions replication retention description <<< "$topic_config"

    echo -e "${YELLOW}Creating: $topic${NC}"

    # Check if topic exists
    if kubectl exec -n $NAMESPACE $KAFKA_POD -- kafka-topics.sh \
        --bootstrap-server $BROKERS \
        --command-config /tmp/client.properties \
        --list 2>/dev/null | grep -q "^${topic}$"; then
        echo -e "${YELLOW}⚠️  Topic already exists, skipping...${NC}"
    else
        # Create topic
        kubectl exec -n $NAMESPACE $KAFKA_POD -- kafka-topics.sh \
            --bootstrap-server $BROKERS \
            --command-config /tmp/client.properties \
            --create \
            --topic $topic \
            --partitions $partitions \
            --replication-factor $replication \
            --config retention.ms=$retention \
            --config compression.type=lz4 \
            --config cleanup.policy=delete \
            --if-not-exists

        echo -e "${GREEN}✅ Created: $topic${NC}"
    fi
    echo ""
done

# List all topics
echo "📋 All Topics:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl exec -n $NAMESPACE $KAFKA_POD -- kafka-topics.sh \
    --bootstrap-server $BROKERS \
    --command-config /tmp/client.properties \
    --list
echo ""

# Show topic details
echo "📊 Topic Details:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for topic_config in "${TOPICS[@]}"; do
    IFS=':' read -r topic _ _ _ _ <<< "$topic_config"

    echo -e "${YELLOW}Topic: $topic${NC}"
    kubectl exec -n $NAMESPACE $KAFKA_POD -- kafka-topics.sh \
        --bootstrap-server $BROKERS \
        --command-config /tmp/client.properties \
        --describe \
        --topic $topic 2>/dev/null || true
    echo ""
done

echo -e "${GREEN}🎉 All topics created successfully!${NC}"
echo ""
echo "💡 Access Kafka UI to view topics:"
echo "   kubectl port-forward -n kafka svc/kafka-ui 8080:8080"
echo "   Open: http://localhost:8080"
