package auth

import (
	"context"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/middleware/selector"
	"github.com/go-kratos/kratos/v2/transport"
)

// EndpointAuthConfig defines auth requirements for an endpoint
type EndpointAuthConfig struct {
	RequireAuth   bool
	RequireRoles  []string
	RequirePerms  []string
	AllowPublic   bool // Skip auth completely
}

// AuthSelector creates a selector middleware based on endpoint configurations
// Usage:
//   authSelector := auth.NewAuthSelector(map[string]auth.EndpointAuthConfig{
//       "/task.v1.TaskService/CreateTask": {RequireAuth: true, RequireRoles: []string{"admin", "manager"}},
//       "/task.v1.TaskService/GetTask":    {RequireAuth: true},
//       "/task.v1.TaskService/Hello":      {AllowPublic: true},
//   })
type AuthSelector struct {
	configs map[string]EndpointAuthConfig
}

// NewAuthSelector creates a new AuthSelector with endpoint configurations
func NewAuthSelector(configs map[string]EndpointAuthConfig) *AuthSelector {
	return &AuthSelector{configs: configs}
}

// Middleware returns the middleware function for Kratos
func (s *AuthSelector) Middleware() middleware.Middleware {
	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (interface{}, error) {
			// Get operation (method) name from transport context
			operation := getOperation(ctx)
			if operation == "" {
				// No operation info, proceed without auth check
				return handler(ctx, req)
			}

			// Get config for this endpoint
			config, exists := s.configs[operation]
			if !exists {
				// No config means default behavior - require auth
				config = EndpointAuthConfig{RequireAuth: true}
			}

			// Skip auth for public endpoints
			if config.AllowPublic {
				return handler(ctx, req)
			}

			// Get user identity
			identity := GetIdentityFromContext(ctx)

			// Check authentication
			if config.RequireAuth && !identity.IsAuthenticated() {
				return nil, errors.Unauthorized("UNAUTHENTICATED", "user not authenticated")
			}

			// Check roles
			if len(config.RequireRoles) > 0 && !identity.HasRole(config.RequireRoles...) {
				return nil, errors.Forbidden("PERMISSION_DENIED", "access denied, required roles: "+joinStrings(config.RequireRoles))
			}

			// Check permissions
			if len(config.RequirePerms) > 0 && !identity.HasAllPermissions(config.RequirePerms...) {
				return nil, errors.Forbidden("PERMISSION_DENIED", "access denied, required permissions: "+joinStrings(config.RequirePerms))
			}

			return handler(ctx, req)
		}
	}
}

// PublicEndpoints returns a selector matcher that matches public endpoints
func PublicEndpoints(operations ...string) selector.MatchFunc {
	return func(ctx context.Context, operation string) bool {
		for _, op := range operations {
			if op == operation {
				return true
			}
		}
		return false
	}
}

// getOperation extracts the operation name from context
func getOperation(ctx context.Context) string {
	if tr, ok := transport.FromServerContext(ctx); ok {
		return tr.Operation()
	}
	return ""
}
