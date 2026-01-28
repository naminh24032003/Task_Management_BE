$query = @'
mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    id
    title
    status
    createdAt
  }
}
'@

$variables = @{
    input = @{
        title = "Test Task for Verification"
        description = "This task verifies the fixes for Bug #1 to #5"
        projectId = "project-verify"
    }
}

$body = @{
    query = $query
    variables = $variables
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "x-user-id" = "user-verify"
    "x-tenant-id" = "tenant-verify"
    "x-email" = "verify@example.com"
    "x-roles" = "admin"
    "x-scopes" = "task:write"
}

$result = Invoke-RestMethod -Uri "http://localhost:4000/graphql" -Method Post -Headers $headers -Body $body
$result | ConvertTo-Json -Depth 10
