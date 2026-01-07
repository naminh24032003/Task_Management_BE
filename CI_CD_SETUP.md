# 🚀 Complete CI/CD Setup Guide - Jenkins + ArgoCD

## 📊 Current Infrastructure Status

### ✅ Already Deployed & Running:
- **Jenkins**: Running on Minikube (http://192.168.49.2:32243)
- **ArgoCD**: Running on Minikube (http://192.168.49.2:32583)
- **User Service**: Deployed in `dev` namespace (2/2 pods running)
- **Task Service**: Deployed in `dev` namespace (2/2 pods running)
- **Monitoring**: ServiceMonitor configured for Prometheus
- **Istio**: VirtualService & DestinationRule configured
- **Helm Charts**: Complete charts in `apps/` and `charts/`

---

## 🎯 CI/CD Architecture

```
┌─────────────┐
│  Developer  │
│  git push   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│                   GitHub/GitLab                     │
│              (Source Code Repository)               │
└──────────────┬──────────────────────────────────────┘
               │
               │ Webhook/Poll
               ▼
┌─────────────────────────────────────────────────────┐
│                     Jenkins                         │
│  ┌────────────────────────────────────────────┐   │
│  │ 1. Checkout Code                           │   │
│  │ 2. Build (npm/go build)                    │   │
│  │ 3. Test (unit tests)                       │   │
│  │ 4. Build Docker Image                      │   │
│  │ 5. Push to Registry                        │   │
│  │ 6. Update Helm Values (Git)                │   │
│  └────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────────┘
               │
               │ Git Push
               ▼
┌─────────────────────────────────────────────────────┐
│              Git Repo (manifests)                   │
│         apps/user-service/values.yaml               │
│         apps/task-service/values.yaml               │
└──────────────┬──────────────────────────────────────┘
               │
               │ Auto-detect changes
               ▼
┌─────────────────────────────────────────────────────┐
│                    ArgoCD                           │
│  ┌────────────────────────────────────────────┐   │
│  │ 1. Detect Git Changes                      │   │
│  │ 2. Compare Desired vs Actual State         │   │
│  │ 3. Sync to Kubernetes                      │   │
│  │ 4. Monitor Health                          │   │
│  └────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│            Kubernetes Cluster (dev)                 │
│  ┌──────────────────┐    ┌──────────────────┐     │
│  │  user-service    │    │  task-service    │     │
│  │  (NestJS/Node)   │    │  (Golang)        │     │
│  │  Port: 50051     │    │  Port: 50052     │     │
│  │  Metrics: 9090   │    │  Metrics: 9091   │     │
│  └──────────────────┘    └──────────────────┘     │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │         Istio Service Mesh                  │  │
│  │  - VirtualService                           │  │
│  │  - DestinationRule                          │  │
│  │  - mTLS                                     │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │         Prometheus Monitoring               │  │
│  │  - ServiceMonitor                           │  │
│  │  - Metrics Collection                       │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
task_management_be/
├── service/
│   ├── user-service/
│   │   ├── Dockerfile                 ✅ Created
│   │   ├── Jenkinsfile                ✅ NEW - CI Pipeline
│   │   ├── src/
│   │   └── package.json
│   └── task-service/
│       ├── Dockerfile                 ✅ Created
│       ├── Jenkinsfile                ✅ NEW - CI Pipeline
│       ├── cmd/
│       └── go.mod
├── apps/
│   ├── user-service/
│   │   ├── Chart.yaml                 ✅ Helm chart
│   │   ├── values.yaml
│   │   └── values-minikube.yaml       ✅ Will be updated by Jenkins
│   └── task-service/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── values-minikube.yaml       ✅ Will be updated by Jenkins
├── charts/
│   └── microservice/                  ✅ Base chart template
│       ├── Chart.yaml
│       ├── templates/
│       │   ├── deployment.yaml
│       │   ├── service.yaml
│       │   └── servicemonitor.yaml
│       └── values.yaml
├── angocd_template/
│   ├── user-service-app.yaml         ✅ NEW - ArgoCD Application
│   └── task-service-app.yaml         ✅ NEW - ArgoCD Application
├── JENKINS_ARGOCD_ACCESS.md           ✅ Access guide
├── DEPLOYMENT_SUMMARY.md              ✅ Deployment summary
└── CI_CD_SETUP.md                     ✅ THIS FILE
```

---

## 🔧 Setup Steps

### Step 1: Configure Docker Registry

You need a Docker registry to store images. Choose one:

#### Option A: Docker Hub (Recommended for testing)
```bash
# Login to Docker Hub
docker login

# Your registry URL: docker.io/your-username
```

#### Option B: Local Registry (For Minikube)
```bash
# Start local registry
docker run -d -p 5000:5000 --restart=always --name registry registry:2

# Make it accessible from Minikube
minikube ssh
echo "192.168.49.1 host.minikube.internal" | sudo tee -a /etc/hosts
exit

# Test
docker tag nginx localhost:5000/nginx:test
docker push localhost:5000/nginx:test
```

#### Option C: GitHub Container Registry
```bash
# Create Personal Access Token with packages:write permission
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Your registry URL: ghcr.io/your-username
```

---

### Step 2: Configure Jenkins Credentials

1. **Access Jenkins UI**: http://192.168.49.2:32243
   - Username: `admin`
   - Password: `Jenkins@2024Secure!`

2. **Add Docker Registry Credentials**:
   ```
   Navigate to: Manage Jenkins → Credentials → System → Global credentials

   Add Credential (Username with password):
   - ID: docker-registry-credentials
   - Username: your-docker-username
   - Password: your-docker-password
   - Description: Docker Registry Credentials

   Add Credential (Secret text):
   - ID: docker-registry-url
   - Secret: docker.io/your-username (or localhost:5000 or ghcr.io/your-username)
   - Description: Docker Registry URL
   ```

3. **Configure Kubernetes Access** (Already done via ServiceAccount):
   Jenkins pod already has access to Kubernetes cluster via `jenkins` ServiceAccount.

---

### Step 3: Create Jenkins Pipeline Jobs

#### For User Service:

1. Go to Jenkins → New Item
2. Name: `user-service-pipeline`
3. Type: Pipeline
4. Configuration:
   ```
   Pipeline Definition: Pipeline script from SCM
   SCM: Git
   Repository URL: https://github.com/your-org/task-management-be.git
   Branch: */main
   Script Path: service/user-service/Jenkinsfile
   ```

#### For Task Service:

1. Go to Jenkins → New Item
2. Name: `task-service-pipeline`
3. Type: Pipeline
4. Configuration:
   ```
   Pipeline Definition: Pipeline script from SCM
   SCM: Git
   Repository URL: https://github.com/your-org/task-management-be.git
   Branch: */main
   Script Path: service/task-service/Jenkinsfile
   ```

---

### Step 4: Deploy ArgoCD Applications

```bash
# Apply ArgoCD Application manifests
kubectl apply -f angocd_template/user-service-app.yaml
kubectl apply -f angocd_template/task-service-app.yaml

# Verify ArgoCD applications
kubectl get applications -n argocd

# Check sync status
kubectl describe application user-service -n argocd
kubectl describe application task-service -n argocd
```

Or via ArgoCD UI (http://192.168.49.2:32583):
1. Login with: `admin` / `7v6XQQvEEfI3YwJW`
2. Click "New App"
3. Fill in details from YAML files
4. Click "Create"

---

### Step 5: Update Jenkinsfiles with Your Registry

Edit both Jenkinsfiles and update:

```groovy
// Before
DOCKER_REGISTRY = credentials('docker-registry-url')

// Make sure the credential ID matches what you created in Jenkins
```

---

### Step 6: Test the Pipeline

#### Manual Trigger:
```bash
# Go to Jenkins UI
# Select user-service-pipeline
# Click "Build Now"
```

#### Git Trigger (after webhook setup):
```bash
# Make a change to user service
cd service/user-service
echo "// Test change" >> src/main.ts
git add .
git commit -m "test: trigger pipeline"
git push origin main

# Jenkins will automatically:
# 1. Detect the push
# 2. Run the pipeline
# 3. Build & push Docker image
# 4. Update Helm values
# 5. Deploy to Kubernetes
```

---

## 🔄 Complete Workflow Example

### Scenario: Update User Service

```bash
# 1. Developer makes changes
cd service/user-service/src
vim app.controller.ts  # Make your changes

# 2. Commit and push
git add .
git commit -m "feat: add new endpoint"
git push origin main

# 3. Jenkins automatically:
#    - Detects push via webhook/polling
#    - Checks out code
#    - Installs dependencies
#    - Runs tests
#    - Builds Docker image (tag: abc123-42)
#    - Pushes to registry
#    - Updates apps/user-service/values-minikube.yaml:
#      image:
#        tag: abc123-42

# 4. ArgoCD automatically:
#    - Detects Git change
#    - Compares with cluster state
#    - Syncs new image to Kubernetes
#    - Monitors rollout health

# 5. Verify deployment
kubectl get pods -n dev -l app=user-service
kubectl logs -n dev -l app=user-service --tail=50

# 6. Check metrics
kubectl port-forward -n dev svc/user-service 9090:9090
curl http://localhost:9090/metrics
```

---

## 🎯 Pipeline Stages Explained

### User Service (NestJS) Pipeline:

1. **Checkout**: Clone Git repository
2. **Build**: `npm ci` + `npm run build`
3. **Test**: `npm run test`
4. **Docker Build**: Multi-stage Dockerfile build
5. **Docker Push**: Push to registry with tags (commit-hash, latest, branch)
6. **Update Helm Values**: Modify `values-minikube.yaml` with new image tag
7. **Deploy**: `kubectl set image` to update deployment
8. **Verify**: Check pod status and health

### Task Service (Golang) Pipeline:

1. **Checkout**: Clone Git repository
2. **Build**: `go build` with optimizations
3. **Test**: `go test ./...`
4. **Docker Build**: Multi-stage Dockerfile build
5. **Docker Push**: Push to registry with tags
6. **Update Helm Values**: Modify `values-minikube.yaml`
7. **Deploy**: `kubectl set image` to update deployment
8. **Verify**: Check pod status and health

---

## 📊 Monitoring the Pipeline

### Jenkins:
```bash
# View build logs
Jenkins UI → Pipeline → Build #X → Console Output

# Check pipeline visualization
Jenkins UI → Pipeline → Build #X → Pipeline Steps
```

### ArgoCD:
```bash
# Via UI
ArgoCD UI → Applications → user-service → Sync Status

# Via CLI
argocd login 192.168.49.2:32583 --username admin --password 7v6XQQvEEfI3YwJW --insecure
argocd app list
argocd app get user-service
argocd app sync user-service
argocd app logs user-service
```

### Kubernetes:
```bash
# Watch deployment
kubectl get pods -n dev -w

# Check rollout status
kubectl rollout status deployment/user-service -n dev

# View events
kubectl get events -n dev --sort-by='.lastTimestamp'

# Check metrics
kubectl top pods -n dev
```

---

## 🔧 Troubleshooting

### Pipeline fails at Docker Build:
```bash
# Check if Docker is accessible
kubectl exec -it jenkins-0 -n jenkins -- docker ps

# Check Minikube Docker env
eval $(minikube docker-env)
docker images
```

### Pipeline fails at Docker Push:
```bash
# Verify credentials
kubectl get secret -n jenkins
kubectl describe secret docker-registry-credentials -n jenkins

# Test registry access
docker login your-registry.com
```

### ArgoCD not syncing:
```bash
# Check ArgoCD application status
kubectl get application user-service -n argocd -o yaml

# Check ArgoCD logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-server

# Manually trigger sync
argocd app sync user-service --force
```

### Deployment not updating:
```bash
# Check if image exists in registry
docker pull your-registry/user-service:tag

# Check deployment events
kubectl describe deployment user-service -n dev

# Check pod logs
kubectl logs -n dev -l app=user-service
```

---

## 🚀 Advanced Configuration

### Enable GitHub Webhooks:

1. **In Jenkins**:
   - Install "GitHub Plugin"
   - Configure GitHub Server in Manage Jenkins → Configure System

2. **In GitHub**:
   - Go to Repository → Settings → Webhooks
   - Add webhook: `http://jenkins-url/github-webhook/`
   - Content type: `application/json`
   - Events: `Push` and `Pull Request`

### Enable Automated Rollback:

```yaml
# Add to Jenkinsfile
post {
    failure {
        script {
            echo "Deployment failed, rolling back..."
            sh "kubectl rollout undo deployment/${SERVICE_NAME} -n ${K8S_NAMESPACE}"
        }
    }
}
```

### Add Slack Notifications:

```groovy
// In Jenkinsfile
post {
    success {
        slackSend(
            color: 'good',
            message: "✅ ${SERVICE_NAME} deployed: ${BUILD_TAG}"
        )
    }
    failure {
        slackSend(
            color: 'danger',
            message: "❌ ${SERVICE_NAME} pipeline failed!"
        )
    }
}
```

---

## 📚 Files Reference

### Created Files:
- ✅ [service/user-service/Jenkinsfile](service/user-service/Jenkinsfile)
- ✅ [service/task-service/Jenkinsfile](service/task-service/Jenkinsfile)
- ✅ [angocd_template/user-service-app.yaml](angocd_template/user-service-app.yaml)
- ✅ [angocd_template/task-service-app.yaml](angocd_template/task-service-app.yaml)

### Existing Files (will be updated by pipeline):
- 📝 [apps/user-service/values-minikube.yaml](apps/user-service/values-minikube.yaml)
- 📝 [apps/task-service/values-minikube.yaml](apps/task-service/values-minikube.yaml)

---

## ✅ Checklist

Before running the pipeline:

- [ ] Docker registry configured and accessible
- [ ] Jenkins credentials added (docker-registry-url, docker-registry-credentials)
- [ ] Jenkins pipeline jobs created
- [ ] ArgoCD applications deployed
- [ ] Git repository URL updated in ArgoCD manifests
- [ ] Docker registry URL updated in Jenkinsfiles
- [ ] Services already deployed in `dev` namespace (✅ Already done!)

---

## 🎓 Next Steps

1. **Test the pipeline**: Make a small change and push
2. **Monitor the flow**: Watch Jenkins → ArgoCD → Kubernetes
3. **Setup webhooks**: Enable automatic triggers
4. **Add more services**: Repeat for api-gateway
5. **Enable notifications**: Add Slack/email alerts
6. **Setup staging environment**: Create staging namespace
7. **Production ready**: Migrate to EKS with production configs

---

**Ready to deploy with Jenkins + ArgoCD!** 🚀

*Generated: 2026-01-07*
