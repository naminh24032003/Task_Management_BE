# Redis Cluster Values Template for ArgoCD
# Managed by Terraform
# Uses bitnami/redis-cluster chart (true cluster mode)

fullnameOverride: "redis-cluster"

usePassword: true
password: ${password}

cluster:
  nodes: ${nodes}
  replicas: ${replicas}

redis:
  resources:
    requests:
      cpu: ${request_cpu}
      memory: ${request_memory}
    limits:
      cpu: ${limit_cpu}
      memory: ${limit_memory}

persistence:
  enabled: false

service:
  type: ClusterIP
  ports:
    redis: 6379

networkPolicy:
  enabled: true
  allowExternal: true

podSecurityContext:
  enabled: true
  fsGroup: 1001

containerSecurityContext:
  enabled: true
  runAsUser: 1001
  runAsNonRoot: true
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
