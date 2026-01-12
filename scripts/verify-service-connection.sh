#!/bin/bash
# Verify which MongoDB cluster a service is connected to

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Verify Service MongoDB Connection${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

PASSWORD="MongoDB%40Root2024Secure%21"

# Function to test connection on a port
test_connection() {
  local PORT=$1
  local EXPECTED_CLUSTER=$2

  echo -e "${YELLOW}Testing connection on localhost:${PORT}...${NC}"

  # Try to connect and get cluster info
  RESULT=$(timeout 3 mongosh "mongodb://root:${PASSWORD}@localhost:${PORT}/admin?authSource=admin" \
    --quiet --eval "sh.status()" 2>&1 | grep -o "shard-[0-9]" | head -1)

  if [ -z "$RESULT" ]; then
    echo -e "${RED}  ❌ No connection on port ${PORT}${NC}"
    echo -e "${YELLOW}  💡 Make sure port-forward is running:${NC}"
    echo -e "     ${CYAN}kubectl port-forward -n ${EXPECTED_CLUSTER%-*} svc/${EXPECTED_CLUSTER%-mongodb} ${PORT}:27017${NC}"
    return 1
  else
    # Get full cluster name from sharding status
    CLUSTER_NAME=$(timeout 3 mongosh "mongodb://root:${PASSWORD}@localhost:${PORT}/admin?authSource=admin" \
      --quiet --eval "sh.status()" 2>&1 | grep -o "[a-z-]*-mongodb-sharded-shard-[0-9]" | head -1)

    echo -e "${GREEN}  ✅ Connected${NC}"
    echo -e "  Cluster: ${CYAN}${CLUSTER_NAME}${NC}"

    # Verify expected cluster
    if [[ "$CLUSTER_NAME" == *"$EXPECTED_CLUSTER"* ]]; then
      echo -e "${GREEN}  ✅ Correct cluster!${NC}"
      return 0
    else
      echo -e "${RED}  ❌ Wrong cluster! Expected ${EXPECTED_CLUSTER}${NC}"
      return 1
    fi
  fi

  echo ""
}

echo -e "${CYAN}[1/2] User Service${NC}"
echo "-------------------------------------------"
echo "Expected: user-mongodb cluster on port 27017"
test_connection 27017 "user-mongodb"
echo ""

echo -e "${CYAN}[2/2] Task Service${NC}"
echo "-------------------------------------------"
echo "Expected: task-mongodb cluster on port 27018"
test_connection 27018 "task-mongodb"
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✅ Verification complete${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  • User service should connect to localhost:27017 (user-mongodb)"
echo "  • Task service should connect to localhost:27018 (task-mongodb)"
echo ""
