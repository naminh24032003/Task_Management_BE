# =============================================================================
# Istio - Traffic Management
# =============================================================================
# Configures VirtualServices and DestinationRules for traffic routing
# =============================================================================

# -----------------------------------------------------------------------------
# DestinationRules - Per Service
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "destination_rules" {
  for_each = var.istio_enabled && var.traffic_management_enabled ? var.services : {}

  yaml_body = <<-YAML
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: ${each.value.name}
  namespace: ${var.namespace}
spec:
  host: ${each.value.host}
  trafficPolicy:
    # mTLS
    tls:
      mode: ${var.mtls_mode == "STRICT" ? "ISTIO_MUTUAL" : "DISABLE"}
    
    # Connection Pool
    connectionPool:
      tcp:
        maxConnections: ${var.connection_pool.tcp_max_connections}
        connectTimeout: ${var.connection_pool.tcp_connect_timeout}
      http:
        h2UpgradePolicy: UPGRADE
        http1MaxPendingRequests: ${var.connection_pool.http1_max_pending_requests}
        http2MaxRequests: ${var.connection_pool.http2_max_requests}
        maxRequestsPerConnection: ${var.connection_pool.max_requests_per_connection}
        maxRetries: 3
    
    # Circuit Breaker (Outlier Detection)
    outlierDetection:
      consecutive5xxErrors: ${var.circuit_breaker.consecutive_errors}
      interval: ${var.circuit_breaker.interval}
      baseEjectionTime: ${var.circuit_breaker.base_ejection_time}
      maxEjectionPercent: ${var.circuit_breaker.max_ejection_percent}
  
  # Subsets for versioned deployments
  subsets:
%{ for version in each.value.versions ~}
    - name: ${version}
      labels:
        version: ${version}
%{ endfor ~}
YAML

  depends_on = [helm_release.istiod]
}

# -----------------------------------------------------------------------------
# VirtualServices - Per Service
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "virtual_services" {
  for_each = var.istio_enabled && var.traffic_management_enabled ? var.services : {}

  yaml_body = <<-YAML
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ${each.value.name}
  namespace: ${var.namespace}
spec:
  hosts:
    - ${each.value.host}
  
  # HTTP Routes
  http:
    - name: "${each.value.name}-http"
      match:
        - port: ${each.value.port}
      timeout: ${var.timeout}
      retries:
        attempts: ${var.retry_attempts}
        perTryTimeout: ${var.retry_per_try_timeout}
        retryOn: ${var.retry_on}
      route:
%{ if var.canary_enabled && length(each.value.versions) > 1 ~}
        - destination:
            host: ${each.value.host}
            subset: ${each.value.versions[0]}
            port:
              number: ${each.value.port}
          weight: ${var.canary_v1_weight}
        - destination:
            host: ${each.value.host}
            subset: ${each.value.versions[1]}
            port:
              number: ${each.value.port}
          weight: ${var.canary_v2_weight}
%{ else ~}
        - destination:
            host: ${each.value.host}
            subset: ${each.value.versions[0]}
            port:
              number: ${each.value.port}
          weight: 100
%{ endif ~}
%{ if each.value.grpc_port != null ~}
  
  # gRPC Routes
    - name: "${each.value.name}-grpc"
      match:
        - port: ${each.value.grpc_port}
      timeout: ${var.timeout}
      retries:
        attempts: ${var.retry_attempts}
        perTryTimeout: ${var.retry_per_try_timeout}
        retryOn: ${var.retry_on}
      route:
        - destination:
            host: ${each.value.host}
            subset: ${each.value.versions[0]}
            port:
              number: ${each.value.grpc_port}
          weight: 100
%{ endif ~}
YAML

  depends_on = [
    helm_release.istiod,
    kubectl_manifest.destination_rules
  ]
}
