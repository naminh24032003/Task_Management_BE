# generate.ps1 - Script to generate proto files for Kratos

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('init', 'api', 'clean', 'all')]
    [string]$Target = 'all'
)

function Init {
    Write-Host "Installing protoc plugins..." -ForegroundColor Green
    go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
    go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@latest
    Write-Host "Done!" -ForegroundColor Green
}

function Generate-API {
    Write-Host "Generating proto files..." -ForegroundColor Green
    
    # Find all .proto files
    $protoFiles = Get-ChildItem -Path ".\api" -Filter "*.proto" -Recurse
    
    foreach ($proto in $protoFiles) {
        Write-Host "Processing: $($proto.FullName)" -ForegroundColor Yellow
        protoc --proto_path=./api `
               --go_out=paths=source_relative:./api `
               --go-grpc_out=paths=source_relative:./api `
               $proto.FullName.Replace((Get-Location).Path + '\', '')
    }
    
    Write-Host "Proto files generated successfully!" -ForegroundColor Green
}

function Clean {
    Write-Host "Cleaning generated files..." -ForegroundColor Green
    Get-ChildItem -Path ".\api" -Filter "*.pb.go" -Recurse | Remove-Item -Force
    Write-Host "Cleaned!" -ForegroundColor Green
}

# Main execution
switch ($Target) {
    'init' { Init }
    'api' { Generate-API }
    'clean' { Clean }
    'all' { Generate-API }
    default { 
        Write-Host "Usage: .\generate.ps1 -Target <init|api|clean|all>" -ForegroundColor Cyan
    }
}
