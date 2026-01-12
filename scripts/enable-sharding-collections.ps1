#!/usr/bin/env pwsh
# Enable sharding for collections in user-service and task-service databases

$ErrorActionPreference = "Stop"

$MONGOS_POD = "mongodb-sharded-mongos-6dffdc5567-qhjgk"
$NAMESPACE = "mongodb-sharded"
$PASSWORD = "MongoDB%40Root2024Secure%21"
$URI = "mongodb://root:$PASSWORD@localhost:27017/admin?authSource=admin"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Enable Sharding for Collections" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# User Service Collections
Write-Host "📦 User Service Collections:" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Gray

try {
    kubectl exec -n $NAMESPACE $MONGOS_POD -- mongosh "$URI" --eval @"
  // Enable sharding for users collection with userId as shard key
  sh.shardCollection('user-service.users', { userId: 'hashed' });
  print('✅ Sharded user-service.users on { userId: hashed }');
"@
} catch {
    Write-Host "⚠️  Collection may not exist yet" -ForegroundColor Yellow
}

Write-Host ""

# Task Service Collections
Write-Host "📦 Task Service Collections:" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Gray

try {
    kubectl exec -n $NAMESPACE $MONGOS_POD -- mongosh "$URI" --eval @"
  // Enable sharding for tasks collection with taskId as shard key
  sh.shardCollection('task-service.tasks', { taskId: 'hashed' });
  print('✅ Sharded task-service.tasks on { taskId: hashed }');

  // If you have more collections, add them here:
  // sh.shardCollection('task-service.projects', { projectId: 'hashed' });
"@
} catch {
    Write-Host "⚠️  Collection may not exist yet" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Sharding Status" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

kubectl exec -n $NAMESPACE $MONGOS_POD -- mongosh "$URI" --eval "sh.status()" | Select-String -Pattern "databases" -Context 0,10

Write-Host ""
Write-Host "✅ Done! Collections will be sharded when they are created." -ForegroundColor Green
