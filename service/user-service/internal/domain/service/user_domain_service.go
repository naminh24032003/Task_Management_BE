package service

import (
	"context"
	"errors"

	"user-service/internal/domain/aggregate"
	"user-service/internal/domain/repository"
)

// UserDomainService contains domain logic that doesn't fit into a single aggregate
type UserDomainService struct {
	userRepo repository.UserRepository
}

// NewUserDomainService creates a new domain service
func NewUserDomainService(userRepo repository.UserRepository) *UserDomainService {
	return &UserDomainService{
		userRepo: userRepo,
	}
}

// IsEmailUnique checks if email is not already taken
func (s *UserDomainService) IsEmailUnique(ctx context.Context, email string) (bool, error) {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		// If not found, email is unique
		return true, nil
	}

	return user == nil, nil
}

// CanDisableUser checks if user can be disabled
func (s *UserDomainService) CanDisableUser(ctx context.Context, user *aggregate.User) error {
	if user.Status == aggregate.UserStatusDisabled {
		return errors.New("user is already disabled")
	}

	// Add more business rules here
	// e.g., check if user has active subscriptions, pending tasks, etc.

	return nil
}
