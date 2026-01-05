# =============================================================================
# MongoDB Sharded Cluster - Helm Release
# =============================================================================

resource "helm_release" "mongodb_sharded" {
  name       = var.release_name
  namespace  = var.namespace
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "mongodb-sharded"
  version    = var.chart_version

  create_namespace = false
  wait             = true
  timeout          = 900 # 15 minutes for large clusters
  atomic           = false
  cleanup_on_fail  = false

  values = [local.helm_values]

  depends_on = [
    kubernetes_namespace.mongodb
  ]
}
