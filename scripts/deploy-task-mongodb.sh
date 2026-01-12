#!/bin/bash
# Deploy MongoDB Sharded Cluster for Task Service

set -e

echo "========================================"
echo "  MongoDB Cluster for Task Service"
echo "========================================"
echo ""

# Configuration
NAMESPACE="mongodb-task"
RELEASE_NAME="task-mongodb"
PASSWORD="MongoDB@Root2024Secure!"

echo "[1/4] Creating namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "[2/4] Adding Bitnami Helm repository (if not exists)..."
helm repo add bitnami https://charts.bitnami.com/bitnami || echo "Repo already exists"
helm repo update

echo ""
echo "[3/4] Deploying MongoDB Sharded Cluster..."
helm upgrade --install $RELEASE_NAME oci://registry-1.docker.io/bitnamicharts/mongodb-sharded \
  --namespace $NAMESPACE \
  --version 9.4.12 \
  --set image.registry=docker.io \
  --set image.repository=bitnamilegacy/mongodb-sharded \
  --set image.tag=8.0.12-debian-12-r0 \
  --set auth.enabled=true \
  --set auth.rootUser=root \
  --set auth.rootPassword="$PASSWORD" \
  --set shards=1 \
  --set configsvr.replicaCount=1 \
  --set configsvr.persistence.size=2Gi \
  --set configsvr.resources.requests.cpu=96m \
  --set configsvr.resources.requests.memory=192Mi \
  --set configsvr.resources.limits.cpu=256m \
  --set configsvr.resources.limits.memory=512Mi \
  --set shardsvr.dataNode.replicaCount=1 \
  --set shardsvr.persistence.size=8Gi \
  --set shardsvr.dataNode.resources.requests.cpu=192m \
  --set shardsvr.dataNode.resources.requests.memory=384Mi \
  --set shardsvr.dataNode.resources.limits.cpu=768m \
  --set shardsvr.dataNode.resources.limits.memory=1536Mi \
  --set mongos.replicaCount=1 \
  --set mongos.resources.requests.cpu=96m \
  --set mongos.resources.requests.memory=192Mi \
  --set mongos.resources.limits.cpu=384m \
  --set mongos.resources.limits.memory=768Mi \
  --set persistence.enabled=true \
  --timeout 15m \
  --wait=false

echo ""
echo "[4/4] Creating task-service database and enabling sharding..."
sleep 30  # Wait for pods to start

# Wait for mongos pod
echo "Waiting for mongos pod to be ready..."
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=mongodb-sharded,app.kubernetes.io/component=mongos \
  -n $NAMESPACE \
  --timeout=300s || echo "Warning: Timeout waiting for pods, check manually"

# Get mongos pod name
MONGOS_POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=mongodb-sharded,app.kubernetes.io/component=mongos -o jsonpath='{.items[0].metadata.name}')

if [ -n "$MONGOS_POD" ]; then
  echo "Mongos pod: $MONGOS_POD"
  echo "Creating task-service database..."

  kubectl exec -n $NAMESPACE $MONGOS_POD -- mongosh \
    "mongodb://root:MongoDB%40Root2024Secure%21@localhost:27017/admin?authSource=admin" \
    --eval "
      sh.enableSharding('task-service');
      print('✅ Enabled sharding for task-service database');
    " || echo "Warning: Failed to enable sharding, you can do this manually later"
fi

echo ""
echo "========================================"
echo "  ✅ Deployment Complete!"
echo "========================================"
echo ""
echo "MongoDB Task Service Cluster Info:"
echo "  Namespace: $NAMESPACE"
echo "  Release: $RELEASE_NAME"
echo "  Service: $RELEASE_NAME.$NAMESPACE.svc.cluster.local:27017"
echo ""
echo "Connection String (Local with port-forward):"
echo "  mongodb://root:MongoDB%40Root2024Secure%21@localhost:27018/task-service?authSource=admin"
echo ""
echo "Connection String (Kubernetes internal):"
echo "  mongodb://root:MongoDB%40Root2024Secure%21@$RELEASE_NAME.$NAMESPACE.svc.cluster.local:27017/task-service?authSource=admin"
echo ""
echo "Port Forward Commands:"
echo "  # For user-service (port 27017):"
echo "  kubectl port-forward -n mongodb-sharded svc/mongodb-sharded 27017:27017"
echo ""
echo "  # For task-service (port 27018):"
echo "  kubectl port-forward -n $NAMESPACE svc/$RELEASE_NAME 27018:27017"
echo ""
echo "Check Status:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl get svc -n $NAMESPACE"
echo ""
