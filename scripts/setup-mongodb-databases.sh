#!/bin/bash
# Setup databases and enable sharding for both MongoDB clusters

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Setup MongoDB Databases${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

PASSWORD="MongoDB%40Root2024Secure%21"

# Setup database for a cluster
setup_database() {
  local NAMESPACE=$1
  local DATABASE=$2

  echo -e "${YELLOW}Setting up database: ${DATABASE}${NC}"
  echo "  Namespace: $NAMESPACE"

  # Get mongos pod
  MONGOS_POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/component=mongos -o jsonpath='{.items[0].metadata.name}')

  if [ -z "$MONGOS_POD" ]; then
    echo -e "${RED}❌ Mongos pod not found in $NAMESPACE${NC}"
    return 1
  fi

  echo "  Mongos pod: $MONGOS_POD"
  echo ""

  # Enable sharding for database
  kubectl exec -n $NAMESPACE $MONGOS_POD -- mongosh \
    "mongodb://root:${PASSWORD}@localhost:27017/admin?authSource=admin" \
    --eval "
      sh.enableSharding('${DATABASE}');
      print('✅ Enabled sharding for ${DATABASE} database');
    "

  echo ""
}

# Setup User Service Database
echo -e "${CYAN}[1/2] User Service Database${NC}"
echo "-------------------------------------------"
setup_database "mongodb-user" "user-service"

# Setup Task Service Database
echo -e "${CYAN}[2/2] Task Service Database${NC}"
echo "-------------------------------------------"
setup_database "mongodb-task" "task-service"

echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✅ Database setup completed${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}Collections will be auto-created and auto-sharded when services start.${NC}"
echo ""
