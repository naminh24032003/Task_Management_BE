package auth

import (
	"context"
	"strings"

	"google.golang.org/grpc/metadata"
)

// ContextKey is a custom type for context keys to avoid collisions
type ContextKey string

const (
	// UserIdentityKey is the context key for user identity
	UserIdentityKey ContextKey = "user_identity"
)

// UserIdentity represents the authenticated user's identity
// These values are extracted from gRPC metadata headers injected by Kong
type UserIdentity struct {
	UserID      string
	TenantID    string
	Email       string
	Roles       []string
	Permissions []string
}

// ExtractIdentityFromContext extracts user identity from gRPC metadata in context
func ExtractIdentityFromContext(ctx context.Context) *UserIdentity {
	// First check if identity is already in context (set by middleware)
	if identity, ok := ctx.Value(UserIdentityKey).(*UserIdentity); ok {
		return identity
	}

	// Extract from gRPC metadata
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil
	}

	identity := &UserIdentity{}

	// Extract x-user-id
	if values := md.Get("x-user-id"); len(values) > 0 {
		identity.UserID = values[0]
	}

	// Extract x-tenant-id
	if values := md.Get("x-tenant-id"); len(values) > 0 {
		identity.TenantID = values[0]
	}

	// Extract x-email
	if values := md.Get("x-email"); len(values) > 0 {
		identity.Email = values[0]
	}

	// Extract x-roles (comma-separated)
	if values := md.Get("x-roles"); len(values) > 0 && values[0] != "" {
		identity.Roles = strings.Split(values[0], ",")
	}

	// Extract x-permissions (comma-separated)
	if values := md.Get("x-permissions"); len(values) > 0 && values[0] != "" {
		identity.Permissions = strings.Split(values[0], ",")
	}

	return identity
}

// IsAuthenticated checks if the user is authenticated
func (u *UserIdentity) IsAuthenticated() bool {
	return u != nil && u.UserID != "" && u.TenantID != ""
}

// HasRole checks if the user has at least one of the specified roles
func (u *UserIdentity) HasRole(roles ...string) bool {
	if u == nil || len(u.Roles) == 0 {
		return false
	}

	for _, requiredRole := range roles {
		for _, userRole := range u.Roles {
			if userRole == requiredRole {
				return true
			}
		}
	}
	return false
}

// HasAllRoles checks if the user has all of the specified roles
func (u *UserIdentity) HasAllRoles(roles ...string) bool {
	if u == nil || len(u.Roles) == 0 {
		return false
	}

	for _, requiredRole := range roles {
		found := false
		for _, userRole := range u.Roles {
			if userRole == requiredRole {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// HasPermission checks if the user has at least one of the specified permissions
func (u *UserIdentity) HasPermission(permissions ...string) bool {
	if u == nil || len(u.Permissions) == 0 {
		return false
	}

	for _, requiredPerm := range permissions {
		for _, userPerm := range u.Permissions {
			if userPerm == requiredPerm {
				return true
			}
		}
	}
	return false
}

// HasAllPermissions checks if the user has all of the specified permissions
func (u *UserIdentity) HasAllPermissions(permissions ...string) bool {
	if u == nil || len(u.Permissions) == 0 {
		return false
	}

	for _, requiredPerm := range permissions {
		found := false
		for _, userPerm := range u.Permissions {
			if userPerm == requiredPerm {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
