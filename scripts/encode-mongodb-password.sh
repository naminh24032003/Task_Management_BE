#!/bin/bash
# URL encode MongoDB password for connection string

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== MongoDB Password URL Encoder ===${NC}\n"

# Get password from K8s secret or user input
if kubectl get secret -n mongodb-sharded mongodb-sharded &>/dev/null; then
  echo "Fetching password from Kubernetes secret..."
  PASSWORD=$(kubectl get secret -n mongodb-sharded mongodb-sharded -o jsonpath="{.data.mongodb-root-password}" | base64 -d)
  echo -e "Original password: ${GREEN}$PASSWORD${NC}"
else
  echo "Enter password to encode (or press Ctrl+C to cancel):"
  read -s PASSWORD
fi

# URL encode the password
ENCODED=$(echo -n "$PASSWORD" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")

echo -e "\n${GREEN}Encoded password:${NC} $ENCODED"
echo ""
echo -e "${YELLOW}Use this in your connection string:${NC}"
echo "mongodb://root:$ENCODED@localhost:27017/user-service?authSource=admin"
echo ""
echo -e "${YELLOW}For Kubernetes (internal):${NC}"
echo "mongodb://root:$ENCODED@mongodb-sharded.mongodb-sharded.svc.cluster.local:27017/user-service?authSource=admin"
