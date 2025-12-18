package handler

import (
	"context"
	"fmt"

	"user-service/internal/application/query"
	"user-service/internal/domain/aggregate"
	"user-service/internal/domain/repository"
)

// QueryHandler handles all read operations (Queries)
type QueryHandler struct {
	userRepo repository.UserRepository
}

// NewQueryHandler creates a new query handler
func NewQueryHandler(userRepo repository.UserRepository) *QueryHandler {
	return &QueryHandler{
		userRepo: userRepo,
	}
}

// HandleGetUser handles get user query
func (h *QueryHandler) HandleGetUser(ctx context.Context, qry *query.GetUserQuery) (*aggregate.User, error) {
	user, err := h.userRepo.FindByID(ctx, qry.UserID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return user, nil
}

// HandleGetUserByEmail handles get user by email query
func (h *QueryHandler) HandleGetUserByEmail(ctx context.Context, qry *query.GetUserByEmailQuery) (*aggregate.User, error) {
	user, err := h.userRepo.FindByEmail(ctx, qry.Email)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return user, nil
}

// HandleListUsers handles list users query
func (h *QueryHandler) HandleListUsers(ctx context.Context, qry *query.ListUsersQuery) ([]*aggregate.User, error) {
	users, err := h.userRepo.List(ctx, qry.Offset, qry.Limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	return users, nil
}
