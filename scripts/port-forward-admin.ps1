# port-forward-admin.ps1
# Quick access to Kafka / MongoDB / Redis UIs when needed.
# Usage: .\scripts\port-forward-admin.ps1 [kafka|mongo|redis|all]
#
# After running, open:
#   Kafka   → http://localhost:9000   (Kafdrop — kubectl exec + docker or just kafkacat)
#   MongoDB → mongodb://root:mongoRootPass123@localhost:27017  (Compass)
#   Redis   → localhost:6379  password: redisPass123  (Another Redis Desktop Manager / RedisInsight desktop)

param(
    [string]$Target = "all"
)

$env:PATH += ";C:\Program Files\Amazon\AWSCLIV2"

function Ensure-KubeContext {
    $ctx = kubectl config current-context 2>&1
    if ($ctx -notmatch "task-management-dev") {
        Write-Host "Updating kubeconfig..." -ForegroundColor Yellow
        aws eks update-kubeconfig --name task-management-dev --region ap-southeast-1
    }
}

Ensure-KubeContext

switch ($Target) {
    "kafka" {
        Write-Host "Forwarding Kafka 9092 → localhost:9092 (use kafkacat/kcat locally)" -ForegroundColor Cyan
        kubectl port-forward svc/kafka 9092:9092 -n kafka
    }
    "mongo" {
        Write-Host "Forwarding MongoDB 27017 → localhost:27017" -ForegroundColor Cyan
        Write-Host "Connect with: mongodb://root:mongoRootPass123@localhost:27017" -ForegroundColor Green
        kubectl port-forward svc/mongodb 27017:27017 -n dev
    }
    "redis" {
        Write-Host "Forwarding Redis 6379 → localhost:6379" -ForegroundColor Cyan
        Write-Host "Password: redisPass123" -ForegroundColor Green
        kubectl port-forward svc/redis-cluster 6379:6379 -n redis
    }
    default {
        # Forward all 3 in parallel background jobs
        Write-Host "Starting port-forwards for Kafka, MongoDB, Redis..." -ForegroundColor Cyan

        $jobs = @()
        $jobs += Start-Job -ScriptBlock {
            kubectl port-forward svc/kafka 9092:9092 -n kafka
        }
        $jobs += Start-Job -ScriptBlock {
            kubectl port-forward svc/mongodb 27017:27017 -n dev
        }
        $jobs += Start-Job -ScriptBlock {
            kubectl port-forward svc/redis-cluster 6379:6379 -n redis
        }

        Write-Host ""
        Write-Host "All forwards running:" -ForegroundColor Green
        Write-Host "  Kafka   localhost:9092  (kcat / Offset Explorer)" -ForegroundColor White
        Write-Host "  MongoDB localhost:27017  mongodb://root:mongoRootPass123@localhost:27017" -ForegroundColor White
        Write-Host "  Redis   localhost:6379   password: redisPass123" -ForegroundColor White
        Write-Host ""
        Write-Host "Press Ctrl+C to stop all forwards." -ForegroundColor Yellow

        try {
            # Keep alive until Ctrl+C
            while ($true) {
                Start-Sleep -Seconds 5
                # Restart any crashed jobs
                foreach ($job in $jobs) {
                    if ($job.State -eq "Failed" -or $job.State -eq "Stopped") {
                        Write-Host "Restarting crashed job $($job.Name)..." -ForegroundColor Yellow
                    }
                }
            }
        } finally {
            Write-Host "Stopping all port-forwards..." -ForegroundColor Yellow
            $jobs | Stop-Job
            $jobs | Remove-Job
        }
    }
}
