# Proto Sync Workflow

This document explains how proto files are managed and synchronized across services.

## Architecture

```
packages/proto/                     ← Source of Truth
├── google/api/
│   ├── annotations.proto
│   └── http.proto
├── user/v1/
│   └── user.proto
├── task/v1/
│   └── task.proto
└── generate.ps1

service/user-service/
├── proto/                          ← Synced Artifact (gitignored)
│   └── user/v1/user.proto
├── src/generated/                  ← Generated TypeScript
│   └── user/v1/user.ts
└── scripts/
    ├── sync-proto.cmd
    └── generate-proto.cmd

service/bff-service/
├── proto/                          ← Synced Artifact (gitignored)
│   ├── user/v1/user.proto
│   └── task/v1/task.proto
└── scripts/
    └── sync-proto.cmd
```

## Workflow

### 1. Edit Proto Files
Always edit proto files in `packages/proto/` - this is the **source of truth**.

### 2. Sync to Services
Run sync script in each service that uses the proto:

```bash
# For user-service
cd service/user-service
npm run proto:sync

# For bff-service
cd service/bff-service
npm run proto:sync
```

### 3. Generate TypeScript Types
After syncing, generate TypeScript types:

```bash
# For user-service (generates to src/generated/)
cd service/user-service
npm run proto:gen
```

### 4. Automatic Sync on Build
Proto sync runs automatically via npm hooks:
- `prebuild` - runs before `npm run build`
- `prestart:dev` - runs before `npm run start:dev`

## Scripts

| Script | Description |
|--------|-------------|
| `proto:sync` | Sync proto files from packages/proto |
| `proto:sync:win` | Windows-specific sync |
| `proto:sync:unix` | Unix/Mac-specific sync |
| `proto:gen` | Generate TypeScript from proto |

## Why This Approach?

1. **Single Source of Truth**: All proto definitions in one place
2. **No Duplication**: Services don't maintain their own proto copies
3. **Consistent APIs**: All services always use the same proto definitions
4. **Gitignore Artifacts**: Synced proto folders are gitignored, only source is tracked
5. **Docker Build**: Docker copies from packages/proto during build

## Docker Considerations

In Dockerfile, copy proto from packages/proto:

```dockerfile
# Copy shared proto definitions
COPY packages/proto /app/packages/proto

# Copy service code
COPY service/user-service /app/service/user-service

# Proto sync will copy from packages/proto to service/proto
WORKDIR /app/service/user-service
RUN npm run proto:sync
```

## Troubleshooting

### Proto mismatch between services
Run `npm run proto:sync` in both services.

### Generated types outdated
Run `npm run proto:gen` after syncing.

### Changes not reflected
1. Check if editing the correct file in `packages/proto/`
2. Run sync in all affected services
3. Regenerate TypeScript types
4. Rebuild services
