# =============================================================================
# BFF Service - Terraform Module
# =============================================================================
# Deploys the BFF (Backend for Frontend) GraphQL Gateway service
# =============================================================================

# -----------------------------------------------------------------------------
# Namespace (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "bff" {
  count = var.bff_enabled && var.create_namespace ? 1 : 0

  metadata {
    name = var.namespace

    labels = {
      name               = var.namespace
      "istio-injection"  = var.istio_enabled ? "enabled" : "disabled"
    }
  }
}

# -----------------------------------------------------------------------------
# BFF Service Helm Release
# -----------------------------------------------------------------------------

resource "helm_release" "bff_service" {
  count = var.bff_enabled ? 1 : 0

  name       = var.release_name
  namespace  = var.namespace
  chart      = var.chart_path != "" ? var.chart_path : "${path.module}/../../../../apps/bff-service"

  # Installation options
  wait             = true
  timeout          = 600
  force_update     = false
  recreate_pods    = false
  cleanup_on_fail  = true
  atomic           = true

  # Dynamic values
  values = [
    yamlencode({
      microservice = {
        nameOverride = var.release_name
        replicaCount = var.replica_count

        image = {
          repository = var.image_repository
          tag        = var.image_tag
          pullPolicy = var.image_pull_policy
        }

        envVarsCM = {
          NODE_ENV = var.environment == "minikube" ? "development" : "production"

          APP_PORT         = "4000"
          APP_METRICS_PORT = "9092"

          # Auth mode: 'kong' (behind Kong) or 'standalone' (validate JWT)
          AUTH_MODE = var.auth_mode

          GRAPHQL_PLAYGROUND    = tostring(var.graphql_playground)
          GRAPHQL_INTROSPECTION = tostring(var.graphql_introspection)
          GRAPHQL_DEBUG         = tostring(var.graphql_debug)

          GRPC_USER_SERVICE_URL = var.user_service_url
          GRPC_TASK_SERVICE_URL = var.task_service_url

          REDIS_HOST       = var.redis_host
          REDIS_PORT       = tostring(var.redis_port)
          REDIS_KEY_PREFIX = "bff-service:"

          RATE_LIMIT_USER_LIMIT  = tostring(var.rate_limit_config.user_limit)
          RATE_LIMIT_USER_WINDOW = tostring(var.rate_limit_config.user_window)
          RATE_LIMIT_IP_LIMIT    = tostring(var.rate_limit_config.ip_limit)
          RATE_LIMIT_IP_WINDOW   = tostring(var.rate_limit_config.ip_window)

          CORS_ORIGINS = join(",", var.cors_origins)
        }

        envFromSecretRefs = ["${var.release_name}-secrets"]

        containerPorts = {
          http = {
            port = 4000
          }
          http-metrics = {
            port = 9092
          }
        }

        service = {
          type = "ClusterIP"
          ports = {
            http = {
              port       = 4000
              targetPort = "http"
            }
            http-metrics = {
              port       = 9092
              targetPort = "http-metrics"
            }
          }
        }

        resources = var.resources

        livenessProbe = {
          httpGet = {
            path = "/health"
            port = "http-metrics"
          }
          initialDelaySeconds = 30
          periodSeconds       = 10
          timeoutSeconds      = 5
          failureThreshold    = 3
        }

        readinessProbe = {
          httpGet = {
            path = "/health"
            port = "http-metrics"
          }
          initialDelaySeconds = 10
          periodSeconds       = 5
          timeoutSeconds      = 3
          failureThreshold    = 3
        }

        metrics = {
          enabled  = var.metrics_enabled
          port     = "http-metrics"
          path     = "/metrics"
          interval = "30s"
          serviceMonitor = {
            labels = var.service_monitor_labels
          }
        }
      }

      secrets = {
        jwtSecret     = var.jwt_secret
        redisPassword = var.redis_password
      }

      bffIngress = {
        enabled   = var.ingress_enabled
        className = var.ingress_class
        annotations = {
          "nginx.ingress.kubernetes.io/proxy-body-size"     = "10m"
          "nginx.ingress.kubernetes.io/proxy-read-timeout"  = "3600"
          "nginx.ingress.kubernetes.io/proxy-send-timeout"  = "3600"
          "nginx.ingress.kubernetes.io/websocket-services"  = var.release_name
          "nginx.ingress.kubernetes.io/enable-websockets"   = "true"
        }
        hosts = [
          {
            host = var.ingress_host
            paths = [
              {
                path     = "/"
                pathType = "Prefix"
              }
            ]
          }
        ]
        tls = var.ingress_tls_enabled ? [
          {
            secretName = var.ingress_tls_secret
            hosts      = [var.ingress_host]
          }
        ] : []
      }
    })
  ]

  depends_on = [kubernetes_namespace.bff]
}
