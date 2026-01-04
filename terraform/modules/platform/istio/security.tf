# =============================================================================
# Istio - Security (mTLS, Authorization)
# =============================================================================
# Configures PeerAuthentication and AuthorizationPolicies
# =============================================================================

# -----------------------------------------------------------------------------
# PeerAuthentication - Namespace Level
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "peer_authentication" {
  count = var.istio_enabled && var.mtls_enabled ? 1 : 0

  yaml_body = <<-YAML
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: ${var.namespace}
spec:
  mtls:
    mode: ${var.mtls_mode}
YAML

  depends_on = [helm_release.istiod]
}

# -----------------------------------------------------------------------------
# PeerAuthentication - Mesh-wide (istio-system)
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "peer_authentication_mesh" {
  count = var.istio_enabled && var.mtls_enabled ? 1 : 0

  yaml_body = <<-YAML
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: ${var.istio_namespace}
spec:
  mtls:
    mode: ${var.mtls_mode}
YAML

  depends_on = [helm_release.istiod]
}

# -----------------------------------------------------------------------------
# AuthorizationPolicy - Allow mesh traffic
# -----------------------------------------------------------------------------

resource "kubectl_manifest" "authorization_policy" {
  count = var.istio_enabled && var.authorization_enabled ? 1 : 0

  yaml_body = <<-YAML
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-mesh
  namespace: ${var.namespace}
spec:
  action: ALLOW
  rules:
    # Allow traffic from within the mesh
    - from:
        - source:
            principals: ["cluster.local/ns/${var.namespace}/sa/*"]
    # Allow traffic from Kong gateway
    - from:
        - source:
            namespaces: ["${var.kong_namespace}"]
    # Allow traffic from Istio ingress gateway
    - from:
        - source:
            namespaces: ["${var.istio_namespace}"]
YAML

  depends_on = [helm_release.istiod]
}
