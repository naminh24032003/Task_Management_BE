#!/bin/bash
# Port-forward MongoDB clusters (CORRECT service names)

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MongoDB Port Forward${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}Choose which cluster to forward:${NC}"
echo "  1. User MongoDB (port 27017)"
echo "  2. Task MongoDB (port 27018)"
echo ""
read -p "Enter choice (1-2): " choice

case $choice in
  1)
    echo -e "${GREEN}Port-forwarding User MongoDB to localhost:27017...${NC}"
    kubectl port-forward -n mongodb-user svc/user-mongodb-mongodb-sharded 27017:27017
    ;;
  2)
    echo -e "${GREEN}Port-forwarding Task MongoDB to localhost:27018...${NC}"
    kubectl port-forward -n mongodb-task svc/task-mongodb-mongodb-sharded 27018:27017
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac
