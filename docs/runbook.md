# Operations Runbook

Operational procedures and troubleshooting guide for the Task Management Platform.

## Table of Contents
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)
- [Incident Response](#incident-response)
- [Monitoring & Alerts](#monitoring--alerts)
- [Backup & Recovery](#backup--recovery)

## Common Operations

### Scaling Services

**Manual Scaling**:
```bash
# Scale specific service
kubectl scale deployment task-service-microservice --replicas=10 -n production

# Or via Helm
helm upgrade task-service ./helm-charts/services/task-service \
    --set microservice.replicas=10 \
    -n production
```

**Check Auto-Scaling Status**:
```bash
kubectl get hpa -n production
kubectl describe hpa task-service-microservice -n production
```

### Deploying Updates

**Update Service Image**:
```bash
helm upgrade task-service ./helm-charts/services/task-service \
    --set microservice.image.tag=v1.3.0 \
    -n production \
    --wait
```

**Rollback Deployment**:
```bash
# Check release history
helm history task-service -n production

# Rollback to previous version
helm rollback task-service -n production

# Rollback to specific revision
helm rollback task-service 3 -n production
```

### Restarting Services

**Rolling Restart**:
```bash
kubectl rollout restart deployment task-service-microservice -n production
kubectl rollout status deployment task-service-microservice -n production
```

**Force Pod Recreation**:
```bash
kubectl delete pod -l app=task-service -n production
```

## Troubleshooting

### Pod Issues

**Pod Won't Start (CrashLoopBackOff)**:
```bash
# Check pod status
kubectl get pods -n production

# View pod events
kubectl describe pod <pod-name> -n production

# Check logs (current)
kubectl logs <pod-name> -n production

# Check logs (previous crash)
kubectl logs <pod-name> -n production --previous

# Debug with shell
kubectl exec -it <pod-name> -n production -- /bin/sh
```

**ImagePullBackOff**:
```bash
# Check image name and tag
kubectl describe pod <pod-name> -n production | grep Image

# Verify ECR access
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

# Check image pull secrets
kubectl get secrets -n production
kubectl describe secret <image-pull-secret> -n production
```

### Service Connectivity Issues

**Service Not Accessible**:
```bash
# Check service endpoints
kubectl get endpoints task-service-microservice -n production

# Check service configuration
kubectl describe svc task-service-microservice -n production

# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup task-service-microservice.production.svc.cluster.local

# Test connectivity from another pod
kubectl exec -it <another-pod> -n production -- curl http://task-service-microservice:8080/health
```

**Kong/NGINX Routing Issues**:
```bash
# Check Ingress configuration
kubectl get ingress -n production
kubectl describe ingress -n production

# Check Kong routes
kubectl exec -it <kong-pod> -n production -- kong routes list

# Check NGINX config
kubectl logs deployment/infrastructure-nginx-ingress -n production
```

### Database Issues

**Connection Failures**:
```bash
# Test RDS connectivity from pod
kubectl exec -it <pod-name> -n production -- sh
# Inside pod:
telnet <rds-endpoint> 5432

# Check database credentials
kubectl get secret db-credentials -n production -o jsonpath='{.data.password}' | base64 -d

# Verify security groups
aws ec2 describe-security-groups --group-ids <sg-id>
```

**Slow Queries**:
```bash
# Connect to RDS
psql -h <rds-endpoint> -U admin -d taskmanagement

# Check running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

# Kill long-running query
SELECT pg_terminate_backend(<pid>);

# Check slow query logs in CloudWatch
```

### Performance Issues

**High CPU/Memory Usage**:
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n production

# Get detailed pod metrics
kubectl describe node <node-name>

# Check HPA metrics
kubectl get hpa -n production --watch
```

**High Latency**:
```bash
# Check service latency in Prometheus
# Query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Access Jaeger for distributed tracing
kubectl port-forward -n production svc/observability-jaeger 16686:16686
# Open: http://localhost:16686

# Check Grafana dashboards
kubectl port-forward -n production svc/observability-grafana 3000:3000
```

## Incident Response

### Service Outage

**Immediate Actions**:
1. Check overall system status:
   ```bash
   kubectl get pods -n production
   kubectl get nodes
   ```

2. Review recent changes:
   ```bash
   helm history task-service -n production
   kubectl rollout history deployment/task-service-microservice -n production
   ```

3. Check logs for errors:
   ```bash
   kubectl logs -l app=task-service -n production --tail=100 --since=10m
   ```

4. Rollback if recent deploy caused issue:
   ```bash
   helm rollback task-service -n production
   ```

### Database Connection Pool Exhaustion

```bash
# Scale up service replicas (NOT recommended as permanent fix)
kubectl scale deployment task-service-microservice --replicas=5 -n production

# Restart database connection pool (if using PgBouncer)
kubectl rollout restart deployment pgbouncer -n production

# Long-term fix: Increase connection pool size in application config
```

### High Error Rate (5xx)

1. **Identify source**:
   ```bash
   # Check Prometheus
   # Query: rate(http_requests_total{status=~"5.."}[5m])
   ```

2. **Check application logs**:
   ```bash
   kubectl logs -l app=task-service -n production | grep -i error
   ```

3. **Check dependencies**:
   - Database: RDS CloudWatch metrics
   - Cache: Redis metrics
   - Kafka: Kafka lag metrics

4. **Mitigate**:
   - Scale up if resource-related
   - Rollback if regression
   - Enable circuit breaker if dependency issue

## Monitoring & Alerts

### Key Metrics to Monitor

**Application Metrics**:
- Request rate (requests/sec)
- Error rate (% 5xx errors)
- Latency (p50, p95, p99)
- Active connections

**Infrastructure Metrics**:
- CPU usage (per pod, per node)
- Memory usage
- Disk I/O
- Network throughput

**Database Metrics**:
- Connection count
- Query latency
- Deadlocks
- Replication lag (if Multi-AZ)

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | > 0.5% | > 1% | Check logs, consider rollback |
| Latency (p95) | > 500ms | > 1s | Scale up, optimize queries |
| CPU Usage | > 70% | > 85% | Scale horizontally |
| Memory Usage | > 75% | > 90% | Check for leaks, scale up |
| Pod Crashes | > 3 in 5min | > 5 in 5min | Rollback deployment |

### Accessing Monitoring Tools

**Grafana**:
```bash
kubectl port-forward -n production svc/observability-grafana 3000:3000
# Access: http://localhost:3000
# Credentials: admin / <from secret>
```

**Prometheus**:
```bash
kubectl port-forward -n production svc/observability-prometheus 9090:9090
# Access: http://localhost:9090
```

## Backup & Recovery

### Database Backups

**Manual Backup**:
```bash
# Create RDS snapshot
aws rds create-db-snapshot \
    --db-instance-identifier task-mgmt-prod-db \
    --db-snapshot-identifier task-mgmt-prod-snapshot-$(date +%Y%m%d-%H%M)

# List snapshots
aws rds describe-db-snapshots --db-instance-identifier task-mgmt-prod-db
```

**Restore from Backup**:
```bash
# Restore to new instance
aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier task-mgmt-prod-db-restored \
    --db-snapshot-identifier task-mgmt-prod-snapshot-20250118-1200

# Update application to point to new endpoint
kubectl edit secret db-credentials -n production
```

### Application State Backup

**Helm Release Backup**:
```bash
# Export all Helm releases
helm list -n production -o yaml > helm-releases-backup.yaml

# Backup Kubernetes manifests
kubectl get all -n production -o yaml > k8s-state-backup.yaml
```

### Disaster Recovery Procedure

1. **Assess damage**:
   - Check AWS Status Dashboard
   - Verify EKS cluster status
   - Check RDS availability

2. **Restore infrastructure** (if needed):
   ```bash
   cd terraform/environments/production
   terraform apply
   ```

3. **Restore database**:
   ```bash
   # Restore from latest automated backup
   aws rds restore-db-instance-to-point-in-time \
       --source-db-instance-identifier task-mgmt-prod-db \
       --target-db-instance-identifier task-mgmt-prod-db-restored \
       --restore-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)
   ```

4. **Redeploy applications**:
   ```bash
   ./scripts/deploy.sh production
   ```

5. **Verify functionality**:
   - Run smoke tests
   - Check all critical endpoints
   - Monitor error rates

## Maintenance Windows

### Planned Maintenance Steps

1. **Notify stakeholders** (24h advance notice)

2. **Pre-maintenance backup**:
   ```bash
   # Snapshot database
   aws rds create-db-snapshot --db-instance-identifier task-mgmt-prod-db \
       --db-snapshot-identifier pre-maintenance-$(date +%Y%m%d)
   
   # Backup Helm releases
   helm list -A -o yaml > pre-maintenance-helm-backup.yaml
   ```

3. **Perform maintenance**:
   - Apply infrastructure changes
   - Deploy application updates
   - Database migrations

4. **Post-maintenance verification**:
   - Run smoke tests
   - Monitor metrics for 30 minutes
   - Verify all services healthy

5. **Rollback plan** (if issues):
   ```bash
   helm rollback <service> -n production
   # Or restore from backup snapshot
   ```

## Emergency Contacts

- **On-Call Engineer**: PagerDuty
- **DevOps Lead**: devops-lead@example.com
- **Database Admin**: dba@example.com
- **AWS Support**: support.aws.amazon.com

## Runbook Maintenance

This runbook should be reviewed and updated:
- **Quarterly**: General review
- **After incidents**: Add new procedures
- **After significant changes**: Update affected sections

**Last Updated**: 2025-12-18
**Next Review**: 2026-03-18
