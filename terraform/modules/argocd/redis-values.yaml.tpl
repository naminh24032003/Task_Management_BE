# Redis Values Template for ArgoCD
# Managed by Terraform

global:
  redis:
    password: ${password}

architecture: standalone

auth:
  enabled: true
  password: ${password}

master:
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

replica:
  replicaCount: 0

sentinel:
  enabled: false

networkPolicy:
  enabled: true
  allowExternal: true

securityContext:
  enabled: true
  fsGroup: 1001
  runAsUser: 1001

containerSecurityContext:
  enabled: true
  runAsUser: 1001
  runAsNonRoot: true
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false