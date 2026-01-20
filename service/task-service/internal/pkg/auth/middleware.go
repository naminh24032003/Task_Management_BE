package auth

import (
	"context"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/transport"
)

// AuthMiddleware extracts user identity from gRPC metadata and stores in context
// This should be applied to all gRPC endpoints
func AuthMiddleware() middleware.Middleware {
	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (interface{}, error) {
			// Extract identity from gRPC metadata
			identity := ExtractIdentityFromContext(ctx)

			// Store identity in context for use by handlers
			if identity != nil {
				ctx = context.WithValue(ctx, UserIdentityKey, identity)
			}

			return handler(ctx, req)
		}
	}
}

// RequireAuthMiddleware requires user to be authenticated
// Returns UNAUTHENTICATED error if not authenticated
func RequireAuthMiddleware() middleware.Middleware {
	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (interface{}, error) {
			identity := GetIdentityFromContext(ctx)

			if !identity.IsAuthenticated() {
				return nil, errors.Unauthorized("UNAUTHENTICATED", "user not authenticated")
			}

			return handler(ctx, req)
		}
	}
}

// RequireRolesMiddleware requires user to have at least one of the specified roles
// Returns PERMISSION_DENIED error if not authorized
func RequireRolesMiddleware(roles ...string) middleware.Middleware {
	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (interface{}, error) {
			identity := GetIdentityFromContext(ctx)

			if !identity.IsAuthenticated() {
				return nil, errors.Unauthorized("UNAUTHENTICATED", "user not authenticated")
			}

			if !identity.HasRole(roles...) {
				return nil, errors.Forbidden("PERMISSION_DENIED", "access denied, required roles: "+joinStrings(roles))
			}

			return handler(ctx, req)
		}
	}
}

// RequirePermissionsMiddleware requires user to have all of the specified permissions
// Returns PERMISSION_DENIED error if not authorized
func RequirePermissionsMiddleware(permissions ...string) middleware.Middleware {
	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (interface{}, error) {
			identity := GetIdentityFromContext(ctx)

			if !identity.IsAuthenticated() {
				return nil, errors.Unauthorized("UNAUTHENTICATED", "user not authenticated")
			}

			if !identity.HasAllPermissions(permissions...) {
				return nil, errors.Forbidden("PERMISSION_DENIED", "access denied, required permissions: "+joinStrings(permissions))
			}

			return handler(ctx, req)
		}
	}
}

// GetIdentityFromContext gets user identity from context
// Returns empty identity if not found (never nil)
func GetIdentityFromContext(ctx context.Context) *UserIdentity {
	if identity, ok := ctx.Value(UserIdentityKey).(*UserIdentity); ok && identity != nil {
		return identity
	}
	return &UserIdentity{}
}

// GetTransportHeader gets a header value from transport context
func GetTransportHeader(ctx context.Context, key string) string {
	if tr, ok := transport.FromServerContext(ctx); ok {
		return tr.RequestHeader().Get(key)
	}
	return ""
}

// joinStrings joins strings with comma
func joinStrings(strs []string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += ", " + strs[i]
	}
	return result
}
