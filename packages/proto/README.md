# Proto Package - gRPC TypeScript Generation

## Prerequisites

1. **Install protoc** (Protocol Buffer Compiler):
   - Windows: `choco install protoc` hoặc download từ https://github.com/protocolbuffers/protobuf/releases
   - macOS: `brew install protobuf`
   - Linux: `apt install -y protobuf-compiler`

2. **Install ts-proto plugin globally**:
   ```bash
   npm install -g ts-proto
   ```

## Generate Code

### Windows (PowerShell):
```powershell
cd packages/proto
.\generate.ps1
```

### Linux/macOS:
```bash
cd packages/proto
chmod +x generate.sh
./generate.sh
```

## Output Structure

```
packages/proto/
├── user/v1/
│   ├── user.proto          # Source proto file
│   └── generated/          # Generated TypeScript
│       └── user.ts
├── task/v1/
│   ├── task.proto          # Source proto file
│   └── generated/          # Generated TypeScript
│       └── task.ts
└── generate.ps1            # Windows script
└── generate.sh             # Linux/macOS script
```

## Usage in Services

Import trong user-service:
```typescript
import { USER_PACKAGE_NAME, USER_SERVICE_NAME, HelloRequest, HelloResponse } from '@proto/user/generated';
```

Đảm bảo tsconfig.json có path mapping:
```json
{
  "compilerOptions": {
    "paths": {
      "@proto/user/*": ["../../packages/proto/user/v1/*"]
    }
  }
}
```
