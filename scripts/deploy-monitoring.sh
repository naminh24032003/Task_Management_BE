#!/bin/bash

# Deploy Monitoring Stack (Prometheus + Grafana + Loki)

set -e

NAMESPACE_MONITORING="monitoring"
NAMESPACE_LOGGING="logging"

echo "🚀 Deploying Monitoring and Logging Stack..."

# Create namespaces
echo "📁 Creating namespaces..."
kubectl create namespace $NAMESPACE_MONITORING --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace $NAMESPACE_LOGGING --dry-run=client -o yaml | kubectl apply -f -

# Add Helm repositories
echo "📦 Adding Helm repositories..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Deploy Logging Stack (Loki + Promtail)
echo "📊 Deploying Logging Stack (Loki + Promtail)..."
helm upgrade --install logging ./charts/platform/logging \
  --namespace $NAMESPACE_LOGGING \
  --create-namespace \
  --wait \
  --timeout 10m

# Deploy Monitoring Stack (Prometheus + Grafana + Alertmanager)
echo "📈 Deploying Monitoring Stack (Prometheus + Grafana)..."
helm upgrade --install monitoring ./charts/platform/monitoring \
  --namespace $NAMESPACE_MONITORING \
  --create-namespace \
  --wait \
  --timeout 10m

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📊 Access Grafana:"
echo "   kubectl port-forward -n $NAMESPACE_MONITORING svc/monitoring-kube-prometheus-grafana 3000:80"
echo "   URL: http://localhost:3000"
echo "   Username: admin"
echo "   Password: prom-operator"
echo ""
echo "🔍 Access Prometheus:"
echo "   kubectl port-forward -n $NAMESPACE_MONITORING svc/monitoring-kube-prometheus-prometheus 9090:9090"
echo "   URL: http://localhost:9090"
echo ""
echo "📝 Access Loki:"
echo "   kubectl port-forward -n $NAMESPACE_LOGGING svc/logging-loki 3100:3100"
echo "   URL: http://localhost:3100"
echo ""
echo "🔎 View logs:"
echo "   kubectl logs -n $NAMESPACE_MONITORING -l app.kubernetes.io/name=grafana --tail=100"
echo "   kubectl logs -n $NAMESPACE_LOGGING -l app=loki --tail=100"
