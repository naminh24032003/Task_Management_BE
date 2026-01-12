# URL encode MongoDB password for connection string (PowerShell version)

Write-Host "=== MongoDB Password URL Encoder ===" -ForegroundColor Yellow
Write-Host ""

# Try to get password from Kubernetes secret
try {
    $secret = kubectl get secret -n mongodb-sharded mongodb-sharded -o jsonpath="{.data.mongodb-root-password}" 2>$null
    if ($secret) {
        $password = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($secret))
        Write-Host "Original password: " -NoNewline
        Write-Host $password -ForegroundColor Green
    } else {
        throw "Secret not found"
    }
} catch {
    Write-Host "Enter password to encode (or press Ctrl+C to cancel):"
    $password = Read-Host -AsSecureString
    $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
}

# URL encode the password
Add-Type -AssemblyName System.Web
$encoded = [System.Web.HttpUtility]::UrlEncode($password)

Write-Host ""
Write-Host "Encoded password: " -NoNewline
Write-Host $encoded -ForegroundColor Green
Write-Host ""
Write-Host "Use this in your connection string:" -ForegroundColor Yellow
Write-Host "mongodb://root:$encoded@localhost:27017/user-service?authSource=admin"
Write-Host ""
Write-Host "For Kubernetes (internal):" -ForegroundColor Yellow
Write-Host "mongodb://root:$encoded@mongodb-sharded.mongodb-sharded.svc.cluster.local:27017/user-service?authSource=admin"
