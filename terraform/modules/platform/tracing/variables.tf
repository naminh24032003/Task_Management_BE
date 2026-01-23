# =============================================================================
# Tracing Module - Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Common Variables
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "namespace" {
  description = "Kubernetes namespace for tracing components"
  type        = string
  default     = "tracing"
}

variable "create_namespace" {
  description = "Create the namespace if it doesn't exist"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Tempo Variables
# -----------------------------------------------------------------------------

variable "tempo_enabled" {
  description = "Enable Grafana Tempo for trace storage"
  type        = bool
  default     = true
}

variable "tempo_chart_version" {
  description = "Tempo Helm chart version"
  type        = string
  default     = "1.7.2"
}

variable "tempo_storage_enabled" {
  description = "Enable persistent storage for Tempo"
  type        = bool
  default     = false
}

variable "tempo_storage_size" {
  description = "Storage size for Tempo"
  type        = string
  default     = "10Gi"
}

variable "tempo_storage_class" {
  description = "Storage class for Tempo PVCs"
  type        = string
  default     = ""
}

variable "tempo_retention" {
  description = "Trace retention period"
  type        = string
  default     = "48h"
}

variable "tempo_resources" {
  description = "Resource limits and requests for Tempo"
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
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { cpu = "500m", memory = "512Mi" }
  }
}

# -----------------------------------------------------------------------------
# OpenTelemetry Collector Variables
# -----------------------------------------------------------------------------

variable "otel_collector_enabled" {
  description = "Enable OpenTelemetry Collector"
  type        = bool
  default     = true
}

variable "otel_collector_image" {
  description = "OpenTelemetry Collector image"
  type        = string
  default     = "otel/opentelemetry-collector-contrib"
}

variable "otel_collector_image_tag" {
  description = "OpenTelemetry Collector image tag"
  type        = string
  default     = "0.91.0"
}

variable "otel_collector_resources" {
  description = "Resource limits and requests for OTEL Collector"
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
    requests = { cpu = "50m", memory = "64Mi" }
    limits   = { cpu = "200m", memory = "256Mi" }
  }
}

variable "otel_collector_replicas" {
  description = "Number of OTEL Collector replicas"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# Kong OpenTelemetry Plugin Variables
# -----------------------------------------------------------------------------

variable "kong_plugin_enabled" {
  description = "Enable Kong OpenTelemetry plugin"
  type        = bool
  default     = true
}

variable "kong_plugin_global" {
  description = "Apply Kong OTEL plugin globally"
  type        = bool
  default     = true
}

variable "kong_namespace" {
  description = "Kong namespace for plugin scope"
  type        = string
  default     = "kong"
}

# -----------------------------------------------------------------------------
# Grafana Integration Variables
# -----------------------------------------------------------------------------

variable "grafana_datasource_enabled" {
  description = "Create Tempo as Grafana data source"
  type        = bool
  default     = true
}

variable "grafana_namespace" {
  description = "Grafana namespace for datasource ConfigMap"
  type        = string
  default     = "monitoring"
}

# -----------------------------------------------------------------------------
# Sampling Configuration
# -----------------------------------------------------------------------------

variable "sampling_rate" {
  description = "Trace sampling rate (0.0 to 1.0)"
  type        = number
  default     = 1.0
  validation {
    condition     = var.sampling_rate >= 0 && var.sampling_rate <= 1
    error_message = "Sampling rate must be between 0.0 and 1.0"
  }
}

variable "batch_span_count" {
  description = "Number of spans to batch before sending"
  type        = number
  default     = 200
}

variable "batch_flush_delay" {
  description = "Delay in seconds before flushing batch"
  type        = number
  default     = 3
}

# -----------------------------------------------------------------------------
# Service Configuration
# -----------------------------------------------------------------------------

variable "service_type" {
  description = "Kubernetes service type"
  type        = string
  default     = "ClusterIP"
}

variable "otlp_grpc_port" {
  description = "OTLP gRPC receiver port"
  type        = number
  default     = 4317
}

variable "otlp_http_port" {
  description = "OTLP HTTP receiver port"
  type        = number
  default     = 4318
}
