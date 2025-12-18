package event_handler

import (
	"context"
	"fmt"

	"user-service/internal/domain/event"
)

// UserEventHandler handles domain events
type UserEventHandler struct {
	// Add dependencies like notification service, audit log, etc.
}

// NewUserEventHandler creates a new event handler
func NewUserEventHandler() *UserEventHandler {
	return &UserEventHandler{}
}

// HandleUserCreated handles UserCreatedEvent
func (h *UserEventHandler) HandleUserCreated(ctx context.Context, event *event.UserCreatedEvent) error {
	// Example: Send welcome email
	fmt.Printf("[Event] User created: ID=%s Email=%s\n", event.AggregateID(), event.Email)

	// TODO: Integrate with notification service
	// - Send welcome email
	// - Create user profile in other services
	// - Log audit trail

	return nil
}

// HandleUserDisabled handles UserDisabledEvent
func (h *UserEventHandler) HandleUserDisabled(ctx context.Context, event *event.UserDisabledEvent) error {
	fmt.Printf("[Event] User disabled: ID=%s\n", event.AggregateID())

	// TODO:
	// - Revoke all active sessions
	// - Notify related services
	// - Send notification to user

	return nil
}
