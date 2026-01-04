# =============================================================================
# Istio Module - Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "namespace" {
  description = "Namespace where services are deployed"
  type        = string
  default     = "dev"
}

variable "create_namespace" {
  description = "Create the namespace if it doesn't exist"
  type        = bool
  default     = false
}

variable "istio_namespace" {
  description = "Namespace for Istio system components"
  type        = string
  default     = "istio-system"
}

# -----------------------------------------------------------------------------
# Istio Installation
# -----------------------------------------------------------------------------

variable "istio_enabled" {
  description = "Enable Istio installation"
  type        = bool
  default     = true
}

variable "istio_base_chart_version" {
  description = "Version of the Istio base Helm chart"
  type        = string
  default     = "1.22.0"
}

variable "istiod_chart_version" {
  description = "Version of the Istiod Helm chart"
  type        = string
  default     = "1.22.0"
}

variable "istio_profile" {
  description = "Istio profile (demo, default, minimal, external)"
  type        = string
  default     = "minimal"
}

# -----------------------------------------------------------------------------
# Istiod Configuration
# -----------------------------------------------------------------------------

variable "istiod_resources" {
  description = "Resource limits and requests for Istiod"
  type = object({
    requests = object({
      cpu    = string
      memory = string
    })
    limits = object({
      cpu    = string
      memory = string
    })
  })
  default = {
    requests = {
      cpu    = "100m"
      memory = "128Mi"
    }
    limits = {
      cpu    = "500m"
      memory = "512Mi"
    }
  }
}

variable "proxy_resources" {
  description = "Resource limits and requests for sidecar proxies"
  type = object({
    requests = object({
      cpu    = string
      memory = string
    })
    limits = object({
      cpu    = string
      memory = string
    })
  })
  default = {
    requests = {
      cpu    = "10m"
      memory = "40Mi"
    }
    limits = {
      cpu    = "200m"
      memory = "256Mi"
    }
  }
}

# -----------------------------------------------------------------------------
# Services Configuration
# -----------------------------------------------------------------------------

variable "services" {
  description = "Services to configure in the mesh"
  type = map(object({
    name      = string
    host      = string
    port      = number
    grpc_port = optional(number)
    versions  = list(string)
  }))
  default = {
    task-service = {
      name      = "task-service"
      host      = "task-service.dev.svc.cluster.local"
      port      = 8080
      grpc_port = 9090
      versions  = ["v1"]
    }
    user-service = {
      name      = "user-service"
      host      = "user-service.dev.svc.cluster.local"
      port      = 3000
      grpc_port = 9090
      versions  = ["v1"]
    }
  }
}

# -----------------------------------------------------------------------------
# Traffic Management
# -----------------------------------------------------------------------------

variable "traffic_management_enabled" {
  description = "Enable traffic management (VirtualServices, DestinationRules)"
  type        = bool
  default     = true
}

variable "canary_enabled" {
  description = "Enable canary deployment configuration"
  type        = bool
  default     = false
}

variable "canary_v1_weight" {
  description = "Traffic weight for v1 in canary deployment"
  type        = number
  default     = 90
}

variable "canary_v2_weight" {
  description = "Traffic weight for v2 in canary deployment"
  type        = number
  default     = 10
}

# -----------------------------------------------------------------------------
# Resilience Configuration
# -----------------------------------------------------------------------------

variable "timeout" {
  description = "Request timeout"
  type        = string
  default     = "10s"
}

variable "retry_attempts" {
  description = "Number of retry attempts"
  type        = number
  default     = 3
}

variable "retry_per_try_timeout" {
  description = "Timeout per retry attempt"
  type        = string
  default     = "3s"
}

variable "retry_on" {
  description = "Conditions to retry on"
  type        = string
  default     = "gateway-error,connect-failure,refused-stream,unavailable,cancelled,retriable-4xx"
}

variable "circuit_breaker" {
  description = "Circuit breaker configuration"
  type = object({
    consecutive_errors   = number
    interval             = string
    base_ejection_time   = string
    max_ejection_percent = number
  })
  default = {
    consecutive_errors   = 5
    interval             = "30s"
    base_ejection_time   = "30s"
    max_ejection_percent = 100
  }
}

variable "connection_pool" {
  description = "Connection pool configuration"
  type = object({
    tcp_max_connections       = number
    tcp_connect_timeout       = string
    http1_max_pending_requests = number
    http2_max_requests        = number
    max_requests_per_connection = number
  })
  default = {
    tcp_max_connections         = 100
    tcp_connect_timeout         = "10s"
    http1_max_pending_requests  = 100
    http2_max_requests          = 1000
    max_requests_per_connection = 10
  }
}

# -----------------------------------------------------------------------------
# Security Configuration
# -----------------------------------------------------------------------------

variable "mtls_enabled" {
  description = "Enable mTLS"
  type        = bool
  default     = true
}

variable "mtls_mode" {
  description = "mTLS mode (STRICT, PERMISSIVE, DISABLE)"
  type        = string
  default     = "STRICT"
}

variable "authorization_enabled" {
  description = "Enable authorization policies"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Observability
# -----------------------------------------------------------------------------

variable "tracing_enabled" {
  description = "Enable distributed tracing"
  type        = bool
  default     = true
}

variable "tracing_sampling_rate" {
  description = "Tracing sampling rate (0-100)"
  type        = number
  default     = 100
}

variable "metrics_enabled" {
  description = "Enable metrics collection"
  type        = bool
  default     = true
}

variable "grafana_dashboards_enabled" {
  description = "Enable Grafana dashboards for Istio"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Monitoring Integration
# -----------------------------------------------------------------------------

variable "monitoring_namespace" {
  description = "Namespace where monitoring stack is deployed"
  type        = string
  default     = "monitoring"
}

variable "prometheus_release" {
  description = "Helm release name of Prometheus"
  type        = string
  default     = "monitoring"
}

# -----------------------------------------------------------------------------
# Kong Integration
# -----------------------------------------------------------------------------

variable "kong_exclude_from_mesh" {
  description = "Exclude Kong from service mesh (no sidecar injection)"
  type        = bool
  default     = true
}

variable "kong_namespace" {
  description = "Namespace where Kong is deployed"
  type        = string
  default     = "kong"
}
