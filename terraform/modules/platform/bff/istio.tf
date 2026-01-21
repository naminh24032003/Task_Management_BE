# =============================================================================
# Istio Integration for BFF Service
# =============================================================================

# -----------------------------------------------------------------------------
# PeerAuthentication - mTLS configuration
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "bff_peer_authentication" {
  count = var.bff_enabled && var.istio_enabled ? 1 : 0

  yaml_body = <<-YAML
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: ${var.release_name}-mtls
  namespace: ${var.namespace}
  labels:
    app: ${var.release_name}
    app.kubernetes.io/name: ${var.release_name}
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: ${var.release_name}
  mtls:
    mode: ${var.istio_mtls_mode}
YAML

  depends_on = [helm_release.bff_service]
}

# -----------------------------------------------------------------------------
# AuthorizationPolicy - Allow BFF to access microservices
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "bff_authorization_policy" {
  count = var.bff_enabled && var.istio_enabled ? 1 : 0

  yaml_body = <<-YAML
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-${var.release_name}-to-services
  namespace: ${var.namespace}
  labels:
    app: ${var.release_name}
spec:
  action: ALLOW
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/${var.namespace}/sa/${var.release_name}"
      to:
        - operation:
            ports:
              - "50051"
              - "50052"
YAML

  depends_on = [helm_release.bff_service]
}

# -----------------------------------------------------------------------------
# DestinationRule - Traffic policy for BFF
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "bff_destination_rule" {
  count = var.bff_enabled && var.istio_enabled ? 1 : 0

  yaml_body = <<-YAML
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: ${var.release_name}
  namespace: ${var.namespace}
  labels:
    app: ${var.release_name}
spec:
  host: ${var.release_name}-microservice.${var.namespace}.svc.cluster.local
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
        connectTimeout: 10s
      http:
        h2UpgradePolicy: UPGRADE
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
YAML

  depends_on = [helm_release.bff_service]
}

# -----------------------------------------------------------------------------
# VirtualService - Traffic routing for BFF
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "bff_virtual_service" {
  count = var.bff_enabled && var.istio_enabled ? 1 : 0

  yaml_body = <<-YAML
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ${var.release_name}
  namespace: ${var.namespace}
  labels:
    app: ${var.release_name}
spec:
  hosts:
    - ${var.release_name}-microservice.${var.namespace}.svc.cluster.local
  http:
    - match:
        - uri:
            prefix: /graphql
      route:
        - destination:
            host: ${var.release_name}-microservice.${var.namespace}.svc.cluster.local
            port:
              number: 4000
      timeout: 30s
      retries:
        attempts: 3
        perTryTimeout: 10s
        retryOn: "connect-failure,refused-stream,unavailable,cancelled,resource-exhausted"
YAML

  depends_on = [helm_release.bff_service]
}
