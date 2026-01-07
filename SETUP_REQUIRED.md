# ⚠️ CẦN SETUP ĐỂ CI/CD TỰ ĐỘNG

## Hiện Trạng

### ✅ ĐÃ CÓ (Running):
- Jenkins Server ✓
- ArgoCD Server ✓
- Services ✓
- Jenkinsfiles ✓
- ArgoCD manifests ✓

### ❌ CHƯA CÓ (Cần setup):
- Docker registry credentials
- Jenkins pipeline jobs
- ArgoCD applications deployed
- Git webhook (optional)

---

## 🔧 3 BƯỚC ĐỂ TỰ ĐỘNG

### BƯỚC 1: Configure Docker Registry (5 phút)

Bạn cần chọn 1 trong 3 options:

#### Option A: Docker Hub (Khuyên dùng - Free)
```bash
# 1. Tạo account tại https://hub.docker.com
# 2. Tạo repository: your-username/user-service
#                     your-username/task-service
# 3. Note credentials:
#    Username: your-docker-username
#    Password: your-docker-password
```

#### Option B: Local Registry (Cho test)
```bash
# 1. Chạy local registry
docker run -d -p 5000:5000 --restart=always --name registry registry:2

# 2. Configure Minikube
minikube ssh
echo "192.168.49.1 host.minikube.internal" | sudo tee -a /etc/hosts
exit

# 3. Registry URL: localhost:5000
```

#### Option C: GitHub Container Registry (Free)
```bash
# 1. Create Personal Access Token
# GitHub → Settings → Developer settings → Personal access tokens
# Permissions: write:packages, read:packages

# 2. Login
echo YOUR_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# 3. Registry URL: ghcr.io/your-username
```

---

### BƯỚC 2: Configure Jenkins (10 phút)

#### 2.1. Access Jenkins
```bash
# Open browser
http://192.168.49.2:32243

# Login
Username: admin
Password: Jenkins@2024Secure!
```

#### 2.2. Add Credentials

**Manage Jenkins → Credentials → System → Global credentials → Add Credentials**

**Credential 1: Docker Registry URL**
```
Kind: Secret text
ID: docker-registry-url
Secret: docker.io/your-username
       (hoặc localhost:5000)
       (hoặc ghcr.io/your-username)
Description: Docker Registry URL
```

**Credential 2: Docker Registry Credentials**
```
Kind: Username with password
ID: docker-registry-credentials
Username: your-docker-username
Password: your-docker-password
Description: Docker Registry Credentials
```

#### 2.3. Create Pipeline Jobs

**Job 1: User Service**
```
1. Click "New Item"
2. Name: user-service-pipeline
3. Type: Pipeline
4. Configuration:
   - Pipeline definition: Pipeline script from SCM
   - SCM: Git
   - Repository URL: https://github.com/your-org/task-management-be.git
     (hoặc đường dẫn Git repo của bạn)
   - Branch: */main
   - Script Path: service/user-service/Jenkinsfile
5. Save
```

**Job 2: Task Service**
```
1. Click "New Item"
2. Name: task-service-pipeline
3. Type: Pipeline
4. Configuration:
   - Pipeline definition: Pipeline script from SCM
   - SCM: Git
   - Repository URL: https://github.com/your-org/task-management-be.git
   - Branch: */main
   - Script Path: service/task-service/Jenkinsfile
5. Save
```

---

### BƯỚC 3: Deploy ArgoCD Applications (2 phút)

#### 3.1. Update Git Repository URL

**Edit file:** `angocd_template/user-service-app.yaml`
```yaml
spec:
  source:
    repoURL: https://github.com/your-org/task-management-be.git  # ← CHANGE THIS
    targetRevision: main
    path: apps/user-service
```

**Edit file:** `angocd_template/task-service-app.yaml`
```yaml
spec:
  source:
    repoURL: https://github.com/your-org/task-management-be.git  # ← CHANGE THIS
    targetRevision: main
    path: apps/task-service
```

#### 3.2. Deploy to ArgoCD
```bash
# Apply manifests
kubectl apply -f angocd_template/user-service-app.yaml
kubectl apply -f angocd_template/task-service-app.yaml

# Verify
kubectl get applications -n argocd
# Should see:
# user-service   Synced   Healthy
# task-service   Synced   Healthy
```

---

## 🎯 SAU KHI SETUP XONG

### Test Workflow:

```bash
# 1. Make a change
cd service/user-service
echo "// test CI/CD" >> src/main.ts

# 2. Commit and push
git add .
git commit -m "test: trigger CI/CD pipeline"
git push origin main

# 3. Watch magic happen! ✨
```

### What Happens:

```
[00:00] Git push completed
        ↓
[00:05] Jenkins detects change (if webhook) or next poll (3 mins)
        ↓
[00:10] Jenkins pipeline starts
        ├─ Stage 1: Checkout ✓
        ├─ Stage 2: Build ✓
        ├─ Stage 3: Test ✓
        ├─ Stage 4: Docker Build ✓
        ├─ Stage 5: Docker Push ✓
        ├─ Stage 6: Update Helm Values ✓
        └─ Stage 7: Deploy ✓
        ↓
[05:00] Jenkins completes
        Git values updated with new image tag
        ↓
[05:30] ArgoCD detects Git change
        ↓
[06:00] ArgoCD syncs to Kubernetes
        ├─ Compare desired vs actual
        ├─ Apply changes
        ├─ Rolling update
        └─ Monitor health ✓
        ↓
[07:00] New pods running with new code!
        ✓ user-service-abc123-xyz
        ✓ Health checks passing
        ✓ Service available

🎉 DEPLOYMENT COMPLETE!
```

### Monitor:

```bash
# Watch Jenkins
http://192.168.49.2:32243
→ user-service-pipeline → Build #1 → Console Output

# Watch ArgoCD
http://192.168.49.2:32583
→ Applications → user-service → Sync Status

# Watch Kubernetes
kubectl get pods -n dev -w
kubectl logs -n dev -l app=user-service -f
```

---

## 📝 Quick Setup Script

**Run this to speed up:**

```bash
./scripts/setup-cicd.sh
```

**Tự động:**
- ✓ Verify services
- ✓ Show access URLs
- ✓ Deploy ArgoCD apps
- ✓ Show instructions

**Manual:**
- Add Docker registry credentials (2.2)
- Create Jenkins jobs (2.3)

---

## ⚡ Quick Reference

### Docker Registry Options:
```
Docker Hub:     docker.io/username
Local:          localhost:5000
GitHub:         ghcr.io/username
```

### Jenkins Credentials IDs:
```
docker-registry-url          (Secret text)
docker-registry-credentials  (Username/Password)
```

### ArgoCD Applications:
```
kubectl get app -n argocd
kubectl describe app user-service -n argocd
argocd app sync user-service
```

---

## 🚨 Common Issues

### Issue 1: Jenkins can't pull from Git
**Solution:**
- If private repo: Add Git credentials to Jenkins
- If public: Use HTTPS URL

### Issue 2: Docker push fails
**Solution:**
- Check credentials: `docker login`
- Verify registry accessible from Minikube

### Issue 3: ArgoCD can't sync
**Solution:**
- Check Git URL in application manifest
- If private: Add Git credentials to ArgoCD

---

## ✅ Verification Checklist

- [ ] Docker registry account created
- [ ] Docker registry credentials in Jenkins
- [ ] Jenkins pipeline jobs created
- [ ] Git repository URL updated in ArgoCD manifests
- [ ] ArgoCD applications deployed
- [ ] Test commit pushed
- [ ] Jenkins pipeline runs successfully
- [ ] Docker image pushed to registry
- [ ] ArgoCD syncs to Kubernetes
- [ ] New pods deployed and running

---

## 🎯 Expected Time

- Setup Docker registry: 5 mins
- Configure Jenkins: 10 mins
- Deploy ArgoCD apps: 2 mins
- **Total: ~17 minutes**

After setup: **Git push = Auto deploy** 🚀

---

## 🔗 References

- [CI_CD_SETUP.md](CI_CD_SETUP.md) - Detailed guide
- [WHAT_CICD_DOES.md](WHAT_CICD_DOES.md) - What CI/CD does
- [JENKINS_ARGOCD_ACCESS.md](JENKINS_ARGOCD_ACCESS.md) - Access info

---

**AFTER THESE 3 STEPS:**
```bash
git push
# → 100% Automatic! 🎉
```
