# =============================================================================
# Monitoring Module Variables
# =============================================================================
# This module deploys the monitoring stack (Prometheus, Grafana, Alertmanager)
# =============================================================================

# =============================================================================
# General Configuration
# =============================================================================

variable "namespace" {
  type        = string
  description = "Kubernetes namespace for monitoring stack"
  default     = "monitoring"
}

variable "create_namespace" {
  type        = bool
  description = "Whether to create the namespace"
  default     = true
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  default     = "dev"
}

# =============================================================================
# Prometheus Configuration
# =============================================================================

variable "prometheus_enabled" {
  type        = bool
  description = "Enable Prometheus deployment"
  default     = true
}

variable "prometheus_chart_version" {
  type        = string
  description = "kube-prometheus-stack Helm chart version"
  default     = "56.6.2"
}

variable "prometheus_retention" {
  type        = string
  description = "Prometheus data retention period"
  default     = "15d"
}

variable "prometheus_storage_size" {
  type        = string
  description = "Prometheus persistent storage size"
  default     = "10Gi"
}

variable "prometheus_storage_enabled" {
  type        = bool
  description = "Enable persistent storage for Prometheus"
  default     = true
}

variable "prometheus_storage_class" {
  type        = string
  description = "Storage class for Prometheus PVC"
  default     = "standard"
}

variable "prometheus_resources" {
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
  description = "Resource requests and limits for Prometheus"
  default = {
    requests = {
      cpu    = "200m"
      memory = "512Mi"
    }
    limits = {
      cpu    = "1000m"
      memory = "2Gi"
    }
  }
}

# =============================================================================
# Alertmanager Configuration
# =============================================================================

variable "alertmanager_enabled" {
  type        = bool
  description = "Enable Alertmanager deployment"
  default     = true
}

variable "alertmanager_storage_size" {
  type        = string
  description = "Alertmanager persistent storage size"
  default     = "5Gi"
}

variable "alertmanager_storage_enabled" {
  type        = bool
  description = "Enable persistent storage for Alertmanager"
  default     = true
}

variable "alertmanager_storage_class" {
  type        = string
  description = "Storage class for Alertmanager PVC"
  default     = "standard"
}

variable "alertmanager_resources" {
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
  description = "Resource requests and limits for Alertmanager"
  default = {
    requests = {
      cpu    = "50m"
      memory = "64Mi"
    }
    limits = {
      cpu    = "200m"
      memory = "256Mi"
    }
  }
}

# =============================================================================
# Grafana Configuration
# =============================================================================

variable "grafana_enabled" {
  type        = bool
  description = "Enable Grafana deployment"
  default     = true
}

variable "grafana_admin_user" {
  type        = string
  description = "Grafana admin username"
  default     = "admin"
  sensitive   = true
}

variable "grafana_admin_password" {
  type        = string
  description = "Grafana admin password"
  default     = "prom-operator"
  sensitive   = true
}

variable "grafana_storage_size" {
  type        = string
  description = "Grafana persistent storage size"
  default     = "10Gi"
}

variable "grafana_storage_enabled" {
  type        = bool
  description = "Enable persistent storage for Grafana"
  default     = true
}

variable "grafana_resources" {
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
  description = "Resource requests and limits for Grafana"
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

variable "grafana_storage_class" {
  type        = string
  description = "Storage class for Grafana PVC"
  default     = "standard"
}

variable "service_type" {
  type        = string
  description = "Service type for all services (ClusterIP, NodePort, LoadBalancer)"
  default     = "ClusterIP"
}

# =============================================================================
# Service Monitor Configuration
# =============================================================================

variable "service_monitor_selector" {
  type        = map(string)
  description = "Label selector for ServiceMonitor resources"
  default     = {}
}

variable "scrape_namespaces" {
  type        = list(string)
  description = "Namespaces to scrape metrics from"
  default     = []
}

# =============================================================================
# Node Exporter Configuration
# =============================================================================

variable "node_exporter_enabled" {
  type        = bool
  description = "Enable Node Exporter deployment"
  default     = true
}

# =============================================================================
# Kube State Metrics Configuration
# =============================================================================

variable "kube_state_metrics_enabled" {
  type        = bool
  description = "Enable Kube State Metrics deployment"
  default     = true
}

# =============================================================================
# Additional Datasources
# =============================================================================

variable "loki_url" {
  type        = string
  description = "Loki datasource URL for Grafana"
  default     = ""
}

variable "jaeger_url" {
  type        = string
  description = "Jaeger datasource URL for Grafana"
  default     = ""
}
