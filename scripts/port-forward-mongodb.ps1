#!/usr/bin/env pwsh
# Port-forward MongoDB clusters (PowerShell version)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MongoDB Port Forward" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Choose which cluster to forward:" -ForegroundColor Yellow
Write-Host "  1. User MongoDB (port 27017)" -ForegroundColor Gray
Write-Host "  2. Task MongoDB (port 27018)" -ForegroundColor Gray
Write-Host "  3. Both (opens 2 terminal windows)" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host "Port-forwarding User MongoDB to localhost:27017..." -ForegroundColor Green
        kubectl port-forward -n mongodb-user svc/user-mongodb 27017:27017
    }
    "2" {
        Write-Host "Port-forwarding Task MongoDB to localhost:27018..." -ForegroundColor Green
        kubectl port-forward -n mongodb-task svc/task-mongodb 27018:27017
    }
    "3" {
        Write-Host "Opening 2 terminals for port-forwarding..." -ForegroundColor Yellow
        Write-Host ""

        # Open terminal 1 for User MongoDB
        Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host 'User MongoDB - Port 27017' -ForegroundColor Cyan
kubectl port-forward -n mongodb-user svc/user-mongodb 27017:27017
"@

        Start-Sleep -Seconds 2

        # Open terminal 2 for Task MongoDB
        Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host 'Task MongoDB - Port 27018' -ForegroundColor Cyan
kubectl port-forward -n mongodb-task svc/task-mongodb 27018:27017
"@

        Write-Host "✅ Opened 2 terminal windows" -ForegroundColor Green
        Write-Host ""
        Write-Host "Port forwards running in background terminals:" -ForegroundColor Yellow
        Write-Host "  • User MongoDB: localhost:27017" -ForegroundColor Gray
        Write-Host "  • Task MongoDB: localhost:27018" -ForegroundColor Gray
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
        exit 1
    }
}
