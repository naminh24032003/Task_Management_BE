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
	UserID   string
	TenantID string
	Email    string
	Roles    []string
	Scopes   []string
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

	// Extract x-scopes (comma-separated)
	if values := md.Get("x-scopes"); len(values) > 0 && values[0] != "" {
		identity.Scopes = strings.Split(values[0], ",")
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

// HasScope checks if the user has at least one of the specified scopes
func (u *UserIdentity) HasScope(scopes ...string) bool {
	if u == nil || len(u.Scopes) == 0 {
		return false
	}

	for _, requiredScope := range scopes {
		for _, userScope := range u.Scopes {
			if userScope == requiredScope {
				return true
			}
		}
	}
	return false
}

// HasAllScopes checks if the user has all of the specified scopes
func (u *UserIdentity) HasAllScopes(scopes ...string) bool {
	if u == nil || len(u.Scopes) == 0 {
		return false
	}

	for _, requiredScope := range scopes {
		found := false
		for _, userScope := range u.Scopes {
			if userScope == requiredScope {
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
