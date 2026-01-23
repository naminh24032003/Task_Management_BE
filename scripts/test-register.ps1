$minikubeIp = "localhost"
$url = "http://$($minikubeIp):8000/graphql"
$random = Get-Random -Minimum 1000 -Maximum 9999
$email = "test_trace_$($random)@example.com"

$query = @{
    query = "mutation { register(input: { tenantId: `"default`", email: `"$email`", password: `"Password123!`", firstName: `"Trace`", lastName: `"User $random`" }) { success message user { id email } } }"
} | ConvertTo-Json

Write-Host "Registering user: $email"
$response = Invoke-RestMethod -Uri $url -Method Post -Body $query -ContentType "application/json"
$response | ConvertTo-Json
