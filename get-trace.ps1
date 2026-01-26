$traceId = $args[0]
if (-not $traceId) { Write-Host "Usage: ./get-trace.ps1 <traceId>"; exit }

$resp = curl.exe -s "http://localhost:3101/api/traces/$traceId"
$data = $resp | ConvertFrom-Json

foreach ($batch in $data.batches) {
    $service = ($batch.resource.attributes | Where-Object { $_.key -eq "service.name" }).value.stringValue
    Write-Host "Service: $service" -ForegroundColor Cyan
    
    foreach ($scopeSpan in $batch.scopeSpans) {
        $scopeName = $scopeSpan.scope.name
        Write-Host "  Scope: $scopeName" -ForegroundColor Yellow
        foreach ($span in $scopeSpan.spans) {
            $duration = ($span.endTimeUnixNano - $span.startTimeUnixNano) / 1000000
            Write-Host "    - $($span.name) ($($duration)ms) [ID: $($span.spanId)] [Parent: $($span.parentSpanId)]"
            if ($span.attributes) {
                foreach ($attr in $span.attributes) {
                    $val = $attr.value.stringValue
                    if (-not $val) { $val = $attr.value.intValue }
                    if (-not $val) { $val = $attr.value.doubleValue }
                    if (-not $val) { $val = $attr.value.boolValue }
                    Write-Host "        $($attr.key): $val" -ForegroundColor Gray
                }
            }
        }
    }
}
