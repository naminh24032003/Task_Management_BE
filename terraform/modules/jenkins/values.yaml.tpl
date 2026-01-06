# Jenkins Helm values template
# Managed by Terraform

global:
  imageRegistry: ""
  imagePullSecrets: []
  defaultStorageClass: ""

replicaCount: 1

# Authentication
jenkinsUser: ${jenkins_user}
jenkinsPassword: ${jenkins_password}

jenkinsHome: /bitnami/jenkins/home
disableInitialization: "no"

# Plugins
plugins:
  - kubernetes
  - workflow-job
  - workflow-aggregator
  - github
  - generic-webhook-trigger
  - git
  - docker-workflow
  - credentials
  - credentials-binding

latestPlugins: true
latestSpecifiedPlugins: false
skipImagePlugins: false
overridePlugins: false

# Init scripts
initScriptsCM: ${init_scripts_cm}
initScriptsSecret: ${init_scripts_secret}

# Configuration as Code
configAsCode:
  enabled: false
  autoReload:
    enabled: true
    initialDelay: 360
    reqRetries: 12
    interval: 10

# Jenkins agents
agent:
  enabled: ${agent_enabled}
  image:
    registry: docker.io
    repository: bitnamilegacy/jenkins-agent
    tag: 0.3327.0-debian-12-r1
    pullPolicy: IfNotPresent
  templateLabel: "kubernetes-agent"
  podLabels: {}
  annotations: {}
  sidecars: []
  resourcesPreset: "small"
  resources: {}
  containerSecurityContext:
    enabled: false
    runAsUser: ""
    runAsGroup: ""
    privileged: false

# Resources for Jenkins server
resourcesPreset: "none"
resources:
  requests:
    cpu: ${request_cpu}
    memory: ${request_memory}
  limits:
    cpu: ${limit_cpu}
    memory: ${limit_memory}

# Container ports
containerPorts:
  http: 8080
  https: 8443
  agentListener: 50000

# Security contexts
podSecurityContext:
  enabled: true
  fsGroupChangePolicy: Always
  sysctls: []
  supplementalGroups: []
  fsGroup: 1001

containerSecurityContext:
  enabled: true
  seLinuxOptions: {}
  runAsUser: 1001
  runAsGroup: 1001
  runAsNonRoot: true
  privileged: false
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
  seccompProfile:
    type: "RuntimeDefault"

# Probes configuration
startupProbe:
  enabled: false
  initialDelaySeconds: 180
  periodSeconds: 10
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 6

livenessProbe:
  enabled: true
  initialDelaySeconds: 180
  periodSeconds: 10
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 6

readinessProbe:
  enabled: true
  initialDelaySeconds: 30
  periodSeconds: 5
  timeoutSeconds: 3
  successThreshold: 1
  failureThreshold: 3

# Service configuration
service:
  type: ${service_type}
  ports:
    http: 80
    https: 443
  nodePorts:
    http: ""
    https: ""
  annotations: {}
  sessionAffinity: None

# Agent listener service
agentListenerService:
  enabled: ${agent_enabled}
  type: ClusterIP
  ports:
    agentListener: 50000
  nodePorts:
    agentListener: ""
  annotations: {}
  sessionAffinity: None

# Network policy
networkPolicy:
  enabled: true
  allowExternal: true
  allowExternalEgress: true
  kubeAPIServerPorts: [443, 6443, 8443]
  extraIngress: []
  extraEgress: []

# Ingress configuration
ingress:
  enabled: ${ingress_enabled}
  pathType: ImplementationSpecific
  hostname: ${ingress_hostname}
  path: /
  annotations: {}
  tls: ${ingress_tls}
  selfSigned: false
  ingressClassName: ${ingress_class}

# Persistence
persistence:
  enabled: ${persistence_enabled}
  storageClass: ${persistence_storage_class}
  existingClaim: ""
  annotations: {}
  accessModes:
    - ReadWriteOnce
  size: ${persistence_size}
  selector: {}

# Volume permissions
volumePermissions:
  enabled: false
  resourcesPreset: "none"
  resources:
    requests:
      cpu: ${volume_permissions_request_cpu}
      memory: ${volume_permissions_request_memory}
    limits:
      cpu: ${volume_permissions_limit_cpu}
      memory: ${volume_permissions_limit_memory}
  securityContext:
    runAsUser: 0

# RBAC
rbac:
  create: true
  rules: []

# Service Account
serviceAccount:
  create: true
  name: ""
  annotations: {}
  automountServiceAccountToken: false

# Pod Disruption Budget
pdb:
  create: true
  minAvailable: ""
  maxUnavailable: ""

# Node selector, affinity, tolerations
nodeSelector: {}
affinity: {}
tolerations: []

# Extra volumes and mounts
extraVolumes: []
extraVolumeMounts: []
sidecars: []
initContainers: []