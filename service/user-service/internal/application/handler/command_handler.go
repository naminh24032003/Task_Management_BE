package handler

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"user-service/internal/application/command"
	"user-service/internal/domain/aggregate"
	"user-service/internal/domain/entity"
	"user-service/internal/domain/repository"
	"user-service/internal/domain/service"
	"user-service/internal/domain/valueobject"
)

// CommandHandler handles all write operations (Commands)
type CommandHandler struct {
	userRepo       repository.UserRepository
	domainService  *service.UserDomainService
	eventPublisher EventPublisher
}

// EventPublisher interface for publishing domain events
type EventPublisher interface {
	Publish(ctx context.Context, events []interface{}) error
}

// NewCommandHandler creates a new command handler
func NewCommandHandler(
	userRepo repository.UserRepository,
	domainService *service.UserDomainService,
	eventPublisher EventPublisher,
) *CommandHandler {
	return &CommandHandler{
		userRepo:       userRepo,
		domainService:  domainService,
		eventPublisher: eventPublisher,
	}
}

// HandleCreateUser handles create user command
func (h *CommandHandler) HandleCreateUser(ctx context.Context, cmd *command.CreateUserCommand) (string, error) {
	// Check email uniqueness (domain rule)
	isUnique, err := h.domainService.IsEmailUnique(ctx, cmd.Email)
	if err != nil {
		return "", fmt.Errorf("failed to check email uniqueness: %w", err)
	}
	if !isUnique {
		return "", fmt.Errorf("email already exists")
	}

	// Create value objects
	email, err := valueobject.NewEmail(cmd.Email)
	if err != nil {
		return "", fmt.Errorf("invalid email: %w", err)
	}

	password, err := valueobject.NewPassword(cmd.Password)
	if err != nil {
		return "", fmt.Errorf("invalid password: %w", err)
	}

	// Create user aggregate
	userID := uuid.New().String()
	user, err := aggregate.NewUser(userID, email, password)
	if err != nil {
		return "", fmt.Errorf("failed to create user: %w", err)
	}

	// Create profile entity
	profile := entity.NewProfile(userID, cmd.FirstName, cmd.LastName)
	user.SetProfile(profile)

	// Activate user immediately (or keep pending for email verification)
	if err := user.Activate(); err != nil {
		return "", err
	}

	// Save to repository
	if err := h.userRepo.Create(ctx, user); err != nil {
		return "", fmt.Errorf("failed to save user: %w", err)
	}

	// Publish domain events
	if h.eventPublisher != nil {
		events := make([]interface{}, len(user.DomainEvents()))
		for i, event := range user.DomainEvents() {
			events[i] = event
		}
		if err := h.eventPublisher.Publish(ctx, events); err != nil {
			// Log error but don't fail the command
			fmt.Printf("failed to publish events: %v\n", err)
		}
		user.ClearDomainEvents()
	}

	return userID, nil
}

// HandleDisableUser handles disable user command
func (h *CommandHandler) HandleDisableUser(ctx context.Context, cmd *command.DisableUserCommand) error {
	// Load user aggregate
	user, err := h.userRepo.FindByID(ctx, cmd.UserID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Check domain rules
	if err := h.domainService.CanDisableUser(ctx, user); err != nil {
		return err
	}

	// Execute domain logic
	if err := user.Disable(); err != nil {
		return err
	}

	// Save changes
	if err := h.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	// Publish events
	if h.eventPublisher != nil {
		events := make([]interface{}, len(user.DomainEvents()))
		for i, event := range user.DomainEvents() {
			events[i] = event
		}
		h.eventPublisher.Publish(ctx, events)
		user.ClearDomainEvents()
	}

	return nil
}

// HandleChangePassword handles change password command
func (h *CommandHandler) HandleChangePassword(ctx context.Context, cmd *command.ChangePasswordCommand) error {
	// Load user
	user, err := h.userRepo.FindByID(ctx, cmd.UserID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Execute domain logic
	if err := user.ChangePassword(cmd.OldPassword, cmd.NewPassword); err != nil {
		return err
	}

	// Save changes
	if err := h.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}
