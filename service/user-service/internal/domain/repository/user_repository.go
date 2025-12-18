package repository

import (
	"context"
	"user-service/internal/domain/aggregate"
)

// UserRepository defines the interface for user persistence
// This is a PORT in Hexagonal Architecture
type UserRepository interface {
	// Create saves a new user
	Create(ctx context.Context, user *aggregate.User) error

	// FindByID finds a user by ID
	FindByID(ctx context.Context, id string) (*aggregate.User, error)

	// FindByEmail finds a user by email
	FindByEmail(ctx context.Context, email string) (*aggregate.User, error)

	// Update updates an existing user
	Update(ctx context.Context, user *aggregate.User) error

	// Delete deletes a user (soft delete recommended)
	Delete(ctx context.Context, id string) error

	// List returns a paginated list of users
	List(ctx context.Context, offset, limit int) ([]*aggregate.User, error)
}
