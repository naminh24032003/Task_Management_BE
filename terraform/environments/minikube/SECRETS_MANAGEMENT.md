# Secrets Management Guide

## 📋 Overview

Terraform configuration đã được tái cấu trúc để tách biệt **sensitive data** (passwords, tokens) khỏi **configuration data** (settings, flags).

## 🔐 File Structure

```
terraform/environments/minikube/
├── variables.tf                    # Non-sensitive variables
├── secrets.tf                      # Sensitive variable definitions
├── secrets.auto.tfvars.example     # Template for secrets (COMMIT THIS)
├── secrets.auto.tfvars             # Actual secrets (GITIGNORED - NEVER COMMIT)
├── terraform.tfvars.example        # Non-sensitive config template
└── .gitignore                      # Protects secrets from being committed
```

## 🚀 Quick Start

### 1. Setup Secrets File

```bash
# Navigate to environment directory
cd terraform/environments/minikube

# Copy the example file
cp secrets.auto.tfvars.example secrets.auto.tfvars

# Edit with your actual secrets
nano secrets.auto.tfvars
# or
vim secrets.auto.tfvars
```

### 2. Set Your Secrets

Edit `secrets.auto.tfvars`:

```hcl
# Jenkins Credentials
jenkins_user     = "admin"
jenkins_password = "MySecurePassword123!"  # Change this!

# Future secrets can be added here
# github_token = "ghp_xxxxxxxxxxxxx"
```

### 3. Verify Gitignore

```bash
# Check that secrets.auto.tfvars is ignored
git status

# You should NOT see secrets.auto.tfvars in the list
# If you do, make sure .gitignore is correct
```

### 4. Deploy

```bash
terraform init
terraform plan    # Verify everything looks good
terraform apply
```

## 📁 What Goes Where?

### ✅ secrets.auto.tfvars (GITIGNORED)
**Use for:**
- Passwords
- API tokens
- Secret keys
- Credentials
- Private keys

**Example:**
```hcl
jenkins_password = "MySecurePassword123!"
github_token     = "ghp_xxxxxxxxxxxxx"
docker_password  = "secret123"
```

### ✅ terraform.tfvars (Optional, also GITIGNORED)
**Use for:**
- Non-sensitive configuration
- Feature flags
- Resource sizes
- Namespaces

**Example:**
```hcl
enable_jenkins_init_scripts  = true
jenkins_deployment_namespace = "production"
```

### ✅ *.example files (COMMITTED to Git)
**Use for:**
- Templates for other developers
- Documentation
- Default values (non-sensitive)

## 🔒 Security Best Practices

### 1. Never Commit Secrets

```bash
# ❌ NEVER do this:
git add secrets.auto.tfvars
git add terraform.tfvars

# ✅ Always check before committing:
git status
git diff --cached
```

### 2. Use Strong Passwords

```hcl
# ❌ Weak
jenkins_password = "admin123"

# ✅ Strong
jenkins_password = "J3nk!ns@2024#Secur3Pass"
```

Requirements:
- Minimum 8 characters (enforced by validation)
- Mix of uppercase, lowercase, numbers, special chars
- Unique per environment

### 3. Rotate Secrets Regularly

```bash
# Update secrets
vim secrets.auto.tfvars

# Apply changes
terraform apply
```

### 4. Use Different Secrets per Environment

```
terraform/environments/
├── minikube/
│   └── secrets.auto.tfvars     # Dev secrets
├── staging/
│   └── secrets.auto.tfvars     # Staging secrets
└── production/
    └── secrets.auto.tfvars     # Production secrets (different!)
```

## 🛡️ What's Protected by .gitignore

The `.gitignore` file protects:

```gitignore
# Secrets files
secrets.auto.tfvars
*secrets*.auto.tfvars
dev.secrets.tfvars
staging.secrets.tfvars
prod.secrets.tfvars

# Legacy tfvars
terraform.tfvars
*.auto.tfvars

# Backups (might contain secrets)
*.backup
*.bak
*.old

# Jenkins backups (might contain secrets)
jenkins-backup-*.tar.gz
```

## 🔍 Verifying Protection

### Check if secrets are ignored

```bash
# Test 1: Check git status
touch secrets.auto.tfvars
git status
# Should NOT appear in untracked files

# Test 2: Try to add (should fail or be ignored)
git add secrets.auto.tfvars
# Should give warning or be ignored

# Clean up test
rm secrets.auto.tfvars
```

### Check current secrets (without revealing them)

```bash
# View variables without values
terraform console
> var.jenkins_user
# Shows: "admin"

> var.jenkins_password
# Shows: (sensitive value)
```

## 📝 Adding New Secrets

### Step 1: Define Variable in secrets.tf

```hcl
variable "github_token" {
  type        = string
  description = "GitHub personal access token"
  sensitive   = true
}
```

### Step 2: Add to secrets.auto.tfvars.example

```hcl
# GitHub Token (for webhooks and GitHub integration)
# github_token = "ghp_your_github_personal_access_token_here"
```

### Step 3: Add to Your Local secrets.auto.tfvars

```hcl
github_token = "ghp_actual_token_here"
```

### Step 4: Use in Configuration

```hcl
# In jenkins.tf or other config files
module "jenkins" {
  source = "../../modules/jenkins"

  jenkins_password = var.jenkins_password
  github_token     = var.github_token  # New secret
}
```

## 🚨 Emergency: Secret Leaked!

If you accidentally committed a secret:

### 1. Immediately Rotate the Secret

```bash
# Change the password/token immediately
vim secrets.auto.tfvars
terraform apply
```

### 2. Remove from Git History

```bash
# Use git filter-branch or BFG Repo-Cleaner
# WARNING: This rewrites history!

# For recent commits
git reset --soft HEAD~1
git reset HEAD secrets.auto.tfvars
git commit -m "Remove sensitive data"

# For old commits - use BFG
# https://rtyley.github.io/bfg-repo-cleaner/
```

### 3. Force Push (if in shared repo)

```bash
git push --force
# Notify team members to re-clone!
```

## 💡 Pro Tips

### 1. Use Environment Variables (Alternative)

```bash
# Set environment variables
export TF_VAR_jenkins_password="MySecurePassword123!"

# Terraform will automatically pick them up
terraform apply
```

### 2. Use Secret Managers (Production)

For production, consider using:
- **AWS Secrets Manager**
- **HashiCorp Vault**
- **Azure Key Vault**
- **GCP Secret Manager**

Example with AWS Secrets Manager:

```hcl
data "aws_secretsmanager_secret_version" "jenkins_password" {
  secret_id = "jenkins/production/admin_password"
}

locals {
  jenkins_password = jsondecode(data.aws_secretsmanager_secret_version.jenkins_password.secret_string)["password"]
}
```

### 3. Use Makefile for Setup

```makefile
setup-secrets: ## Setup secrets file
	@if [ ! -f secrets.auto.tfvars ]; then \
		cp secrets.auto.tfvars.example secrets.auto.tfvars; \
		echo "✅ Created secrets.auto.tfvars"; \
		echo "⚠️  Please edit secrets.auto.tfvars and set your actual secrets"; \
	else \
		echo "✅ secrets.auto.tfvars already exists"; \
	fi

check-secrets: ## Check if secrets are set
	@if [ ! -f secrets.auto.tfvars ]; then \
		echo "❌ secrets.auto.tfvars not found!"; \
		echo "Run: make setup-secrets"; \
		exit 1; \
	fi
	@grep -q "CHANGE-ME" secrets.auto.tfvars && \
		echo "⚠️  Warning: Default password detected. Please update secrets.auto.tfvars" || \
		echo "✅ Secrets file configured"
```

## 📚 Reference

### Files Overview

| File | Committed? | Purpose |
|------|-----------|---------|
| `secrets.tf` | ✅ Yes | Variable definitions |
| `secrets.auto.tfvars.example` | ✅ Yes | Template/documentation |
| `secrets.auto.tfvars` | ❌ **NEVER** | Actual secrets |
| `terraform.tfvars.example` | ✅ Yes | Non-sensitive config template |
| `terraform.tfvars` | ❌ No | Non-sensitive config (optional) |
| `.gitignore` | ✅ Yes | Protection rules |

### Variable Sensitivity

| Variable | Sensitive? | File |
|----------|-----------|------|
| `jenkins_user` | ❌ No | secrets.tf (default: "admin") |
| `jenkins_password` | ✅ **YES** | secrets.auto.tfvars |
| `enable_jenkins_init_scripts` | ❌ No | terraform.tfvars |
| `jenkins_deployment_namespace` | ❌ No | terraform.tfvars |

## ✅ Checklist

Before deploying:

- [ ] Created `secrets.auto.tfvars` from example
- [ ] Set strong password (minimum 8 chars)
- [ ] Verified `secrets.auto.tfvars` is in `.gitignore`
- [ ] Checked `git status` (secrets should NOT appear)
- [ ] Used different secrets for different environments
- [ ] Documented where secrets are stored (team knowledge)

## 🆘 Support

If you have questions about secrets management:

1. Check this guide
2. Review `.gitignore` to see what's protected
3. Test with `git status` before committing
4. When in doubt, ask the team!

---

**Remember: Security is everyone's responsibility! 🔐**