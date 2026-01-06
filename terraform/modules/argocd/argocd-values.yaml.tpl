# ArgoCD Values Template
# Managed by Terraform

global:
  imageRegistry: ""
  imagePullSecrets: []

# Admin credentials
config:
  secret:
    argocdServerAdminPassword: ${admin_password}
    argocdServerAdminPasswordMtime: ""

# Controller configuration
controller:
  replicaCount: ${controller_replica_count}

  resources:
    requests:
      cpu: ${controller_request_cpu}
      memory: ${controller_request_memory}
    limits:
      cpu: ${controller_limit_cpu}
      memory: ${controller_limit_memory}

  containerSecurityContext:
    enabled: true
    runAsNonRoot: true
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: ["ALL"]

# Server configuration (UI/API)
server:
  resources:
    requests:
      cpu: ${server_request_cpu}
      memory: ${server_request_memory}
    limits:
      cpu: ${server_limit_cpu}
      memory: ${server_limit_memory}

  service:
    type: ${service_type}

  containerSecurityContext:
    enabled: true
    runAsNonRoot: true
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: ["ALL"]

  ingress:
    enabled: ${ingress_enabled}
    hostname: ${ingress_hostname}
    ingressClassName: ${ingress_class}
    tls: ${ingress_tls}
    selfSigned: false

# Repo server configuration
repoServer:
  resources:
    requests:
      cpu: ${repo_server_request_cpu}
      memory: ${repo_server_request_memory}
    limits:
      cpu: ${repo_server_limit_cpu}
      memory: ${repo_server_limit_memory}

  containerSecurityContext:
    enabled: true
    runAsNonRoot: true
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: ["ALL"]

# ApplicationSet controller
applicationSet:
  resources:
    requests:
      cpu: ${application_set_request_cpu}
      memory: ${application_set_request_memory}
    limits:
      cpu: ${application_set_limit_cpu}
      memory: ${application_set_limit_memory}

  containerSecurityContext:
    enabled: true
    runAsNonRoot: true
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: ["ALL"]

# Notifications controller
notifications:
  enabled: true

  resources:
    requests:
      cpu: ${notifications_request_cpu}
      memory: ${notifications_request_memory}
    limits:
      cpu: ${notifications_limit_cpu}
      memory: ${notifications_limit_memory}

  containerSecurityContext:
    enabled: true
    runAsNonRoot: true
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: ["ALL"]

# Redis configuration
redis:
  enabled: ${redis_enabled}

  %{ if redis_enabled }
  # Use external Redis
  externalRedis:
    host: ${redis_host}
    port: 6379
    password: ${redis_password}
  %{ endif }

# Dex (disabled - using built-in auth)
dex:
  enabled: false

# Metrics
metrics:
  enabled: false

# RBAC
rbac:
  create: true

# Service Account
serviceAccount:
  create: true
  automountServiceAccountToken: true

# Network Policy
networkPolicy:
  enabled: true
