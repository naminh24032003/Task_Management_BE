#!/bin/bash
# Test MongoDB connections for both clusters

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MongoDB Clusters Connection Test${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Password
PASSWORD="MongoDB%40Root2024Secure%21"

# Function to test cluster
test_cluster() {
  local NAMESPACE=$1
  local CLUSTER_NAME=$2
  local DATABASE=$3

  echo -e "${YELLOW}Testing ${CLUSTER_NAME}...${NC}"
  echo "  Namespace: $NAMESPACE"
  echo "  Database: $DATABASE"
  echo ""

  # Get mongos pod
  MONGOS_POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/component=mongos -o jsonpath='{.items[0].metadata.name}')

  if [ -z "$MONGOS_POD" ]; then
    echo -e "${RED}  ❌ Mongos pod not found${NC}"
    return 1
  fi

  echo "  Mongos pod: $MONGOS_POD"

  # Test connection
  RESULT=$(kubectl exec -n $NAMESPACE $MONGOS_POD -- mongosh \
    "mongodb://root:${PASSWORD}@localhost:27017/admin?authSource=admin" \
    --quiet \
    --eval "
      try {
        var dbs = db.adminCommand('listDatabases').databases;
        var hasDb = dbs.some(d => d.name === '${DATABASE}');
        print(JSON.stringify({
          connected: true,
          hasDatabase: hasDb,
          databases: dbs.map(d => d.name)
        }));
      } catch(e) {
        print(JSON.stringify({connected: false, error: e.message}));
      }
    " 2>&1)

  # Parse result
  if echo "$RESULT" | grep -q '"connected":true'; then
    echo -e "${GREEN}  ✅ Connection successful${NC}"

    if echo "$RESULT" | grep -q '"hasDatabase":true'; then
      echo -e "${GREEN}  ✅ Database '${DATABASE}' exists${NC}"
    else
      echo -e "${YELLOW}  ⚠️  Database '${DATABASE}' not found (will be created on first use)${NC}"
    fi

    # List databases
    echo -e "${CYAN}  Databases:${NC}"
    echo "$RESULT" | grep -o '"databases":\[.*\]' | sed 's/"databases":\[//;s/\]//;s/"//g' | tr ',' '\n' | sed 's/^/    • /'
  else
    echo -e "${RED}  ❌ Connection failed${NC}"
    echo "$RESULT"
    return 1
  fi

  echo ""
}

# Test User MongoDB
echo -e "${CYAN}[1/2] User Service MongoDB${NC}"
echo "-------------------------------------------"
test_cluster "mongodb-user" "user-mongodb" "user-service"

# Test Task MongoDB
echo -e "${CYAN}[2/2] Task Service MongoDB${NC}"
echo "-------------------------------------------"
test_cluster "mongodb-task" "task-mongodb" "task-service"

echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✅ All tests completed${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Port-forward clusters:"
echo "   ${CYAN}kubectl port-forward -n mongodb-user svc/user-mongodb 27017:27017${NC}"
echo "   ${CYAN}kubectl port-forward -n mongodb-task svc/task-mongodb 27018:27017${NC}"
echo ""
echo "2. Start services:"
echo "   ${CYAN}cd service/user-service && npm run start${NC}"
echo "   ${CYAN}cd service/task-service && make run${NC}"
echo ""
