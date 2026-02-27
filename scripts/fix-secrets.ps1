$JWT = "tDH2GZVkvyrq3gcT96auMiOEnApeodJ714UBxmlIWwNf5FQCYhsPzjLR0SbX8K"
$REGION = "ap-southeast-1"

function Put-Secret {
    param($SecretId, $SecretJson)
    $tmpFile = "C:\Temp\aws-secret-tmp.json"
    New-Item -ItemType Directory -Force "C:\Temp" | Out-Null
    # Escape inner double quotes for embedding in outer JSON string
    $escaped = $SecretJson -replace '"', '\\"'
    $outerJson = '{"SecretId":"' + $SecretId + '","SecretString":"' + $escaped + '"}'
    [System.IO.File]::WriteAllText($tmpFile, $outerJson)
    Write-Host "Sending to $SecretId"
    $result = aws secretsmanager put-secret-value --region $REGION --cli-input-json "file://$tmpFile" 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: $result" -ForegroundColor Red }
    else { Write-Host "OK: VersionId=$($result | ConvertFrom-Json | Select-Object -ExpandProperty VersionId 2>$null)" -ForegroundColor Green }
}

Put-Secret "task-management/dev/bff-service" ('{"JWT_SECRET":"' + $JWT + '","REDIS_PASSWORD":"redisPass123"}')

Put-Secret "task-management/dev/user-service" ('{"MONGODB_URI":"mongodb://appuser:appPass123@mongodb.dev.svc.cluster.local:27017/user-service?authSource=user-service","JWT_SECRET":"' + $JWT + '","REDIS_PASSWORD":"redisPass123","GOOGLE_CLIENT_ID":"REPLACE_WITH_REAL_GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET":"REPLACE_WITH_REAL_GOOGLE_CLIENT_SECRET","KAFKA_PASSWORD":""}')

Put-Secret "task-management/dev/task-service" '{"MONGODB_URI":"mongodb://appuser:appPass123@mongodb.dev.svc.cluster.local:27017/task-service?authSource=task-service","REDIS_PASSWORD":"redisPass123","KAFKA_SASL_PASSWORD":""}'

Put-Secret "task-management/dev/notification-service" '{"MONGODB_URI":"mongodb://appuser:appPass123@mongodb.dev.svc.cluster.local:27017/notification_db?authSource=notification_db","REDIS_PASSWORD":"redisPass123","KAFKA_SASL_PASSWORD":""}'

Write-Host "`n=== Verifying ===" -ForegroundColor Yellow
foreach ($svc in @("bff-service","user-service","task-service","notification-service")) {
    $val = (aws secretsmanager get-secret-value --region $REGION --secret-id "task-management/dev/$svc" --output json | ConvertFrom-Json).SecretString
    try {
        $p = $val | ConvertFrom-Json
        Write-Host "${svc}: VALID JSON keys=[$($p.PSObject.Properties.Name -join ',')] " -ForegroundColor Green
    } catch {
        Write-Host "${svc}: STILL INVALID: $($val.Substring(0,80))" -ForegroundColor Red
    }
}
