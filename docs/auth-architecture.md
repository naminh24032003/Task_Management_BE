# Authentication & Authorization Architecture

## Overview

```
Client
  |
  | JWT (Authorization: Bearer <token>)
  v
Kong OSS
  - Verify JWT (signature, exp, algorithm)
  - Reject if invalid
  - Inject identity headers
  |
  | x-user-id, x-tenant-id, x-roles, x-permissions, x-email
  v
gRPC Gateway
  - Map HTTP headers → gRPC metadata
  |
  v
Service
  - Extract identity from metadata
  - Perform AuthZ (role/permission checks)
  - Execute business logic
```

## Kong OSS Authentication (AuthN)

Kong handles JWT verification using a custom `pre-function` plugin:

### What Kong Does:
1. **Verify JWT signature** (HS256)
2. **Check token expiration** (exp claim)
3. **Validate token format** (3 parts, correct algorithm)
4. **Verify token type** (must be 'access')
5. **Inject identity headers** from JWT claims:
   - `x-user-id` ← JWT `sub` claim
   - `x-tenant-id` ← JWT `tenantId` claim
   - `x-email` ← JWT `email` claim
   - `x-roles` ← JWT `roles` claim (comma-separated)
   - `x-permissions` ← JWT `permissions` claim (comma-separated)

### What Kong Does NOT Do:
- Check business permissions
- Understand domain logic
- Perform role-based access control

### Public Paths (No Auth Required):
- `/v1/auth/register`
- `/v1/auth/login`
- `/v1/auth/google`
- `/v1/auth/refresh`
- `/healthz`
- `/api/health`

## gRPC Gateway Header Mapping

The gRPC Gateway forwards these HTTP headers to gRPC metadata:

| HTTP Header | gRPC Metadata |
|-------------|---------------|
| x-user-id | x-user-id |
| x-tenant-id | x-tenant-id |
| x-roles | x-roles |
| x-permissions | x-permissions |
| x-email | x-email |
| Authorization | authorization |
| x-request-id | x-request-id |

## Service-Level Authorization (AuthZ)

Services use gRPC interceptors and guards for authorization:

### Components:
1. **GrpcAuthInterceptor**: Extracts identity from metadata
2. **GrpcAuthGuard**: Verifies user is authenticated
3. **GrpcRolesGuard**: Checks required roles
4. **GrpcPermissionsGuard**: Checks required permissions

### Decorators:
- `@UseGuards(GrpcAuthGuard)` - Require authentication
- `@UseGuards(GrpcAuthGuard, GrpcRolesGuard)` + `@GrpcRequireRoles('admin')` - Require role
- `@UseGuards(GrpcAuthGuard, GrpcPermissionsGuard)` + `@GrpcRequirePermissions('users:write')` - Require permission

### Protected Endpoints (Admin Only):
- `CreateUser` - Create new users
- `DeleteUser` - Delete users
- `ActivateUser` - Activate users
- `DeactivateUser` - Deactivate users
- `SuspendUser` - Suspend users
- `AssignRoles` - Assign roles to users
- `RemoveRoles` - Remove roles from users

### Protected Endpoints (Authenticated Users):
- `GetMe` - Get current user profile

## JWT Token Structure

```json
{
  "sub": "user-id",
  "tenantId": "tenant-id",
  "email": "user@example.com",
  "permissions": ["users:read", "tasks:write"],
  "roles": ["admin", "user"],
  "type": "access",
  "iat": 1234567890,
  "exp": 1234571490
}
```

## Deployment

### 1. Enable Kong pre-function plugin
```bash
kubectl set env deployment/kong-kong -n kong KONG_UNTRUSTED_LUA=on
```

### 2. Apply Kong JWT Plugin
```bash
kubectl apply -f charts/platform/kong/templates/jwt-plugin.yaml
kubectl apply -f charts/platform/kong/templates/ingress.yaml
```

### 3. Rebuild and Deploy gRPC Gateway
```bash
# Build new image
docker build -t grpc-gateway:v8 -f api-gateway/grpc-gateway/Dockerfile .

# Load to minikube
minikube image load grpc-gateway:v8

# Update deployment
kubectl set image deployment/grpc-gateway -n kong grpc-gateway=grpc-gateway:v8
```

### 4. Rebuild and Deploy User Service
```bash
# Build user-service with new auth guards
cd service/user-service
npm run build

# Build Docker image (if using containerized deployment)
docker build -t user-service:latest .

# Load to minikube
minikube image load user-service:latest

# Update deployment
kubectl set image deployment/user-service -n dev microservice=user-service:latest
```

## Testing

### 1. Login to get token
```bash
curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"test-tenant","email":"test@example.com","password":"Test@12345"}'
```

### 2. Access protected endpoint
```bash
curl http://localhost:8000/v1/users/me \
  -H "Authorization: Bearer <access_token>"
```

### 3. Access admin endpoint (will fail without admin role)
```bash
curl -X DELETE http://localhost:8000/v1/users/<user-id> \
  -H "Authorization: Bearer <access_token>"
# Returns: {"code":"PERMISSION_DENIED","message":"Access denied. Required roles: admin"}
```
