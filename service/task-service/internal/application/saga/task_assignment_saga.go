package saga

import (
	"context"
	"fmt"

	"task-service/internal/application/command"
	"task-service/internal/application/handler"
)

// TaskAssignmentSaga orchestrates the task assignment process
// Saga handles distributed transactions across multiple services
type TaskAssignmentSaga struct {
	commandHandler *handler.CommandHandler
	userClient     UserClient
}

// UserClient interface for calling user-service
type UserClient interface {
	ValidateUser(ctx context.Context, userID string) (bool, error)
	GetUserCapacity(ctx context.Context, userID string) (int, error)
}

// NewTaskAssignmentSaga creates a new saga
func NewTaskAssignmentSaga(commandHandler *handler.CommandHandler, userClient UserClient) *TaskAssignmentSaga {
	return &TaskAssignmentSaga{
		commandHandler: commandHandler,
		userClient:     userClient,
	}
}

// Execute executes the task assignment saga
func (s *TaskAssignmentSaga) Execute(ctx context.Context, taskID, assigneeID string) error {
	// Step 1: Validate user exists
	valid, err := s.userClient.ValidateUser(ctx, assigneeID)
	if err != nil {
		return fmt.Errorf("failed to validate user: %w", err)
	}
	if !valid {
		return fmt.Errorf("user %s not found", assigneeID)
	}

	// Step 2: Check user capacity
	capacity, err := s.userClient.GetUserCapacity(ctx, assigneeID)
	if err != nil {
		return fmt.Errorf("failed to get user capacity: %w", err)
	}
	if capacity <= 0 {
		return fmt.Errorf("user %s has no capacity for new tasks", assigneeID)
	}

	// Step 3: Assign task
	cmd := command.NewAssignTaskCommand(taskID, assigneeID)
	if err := s.commandHandler.HandleAssignTask(ctx, cmd); err != nil {
		// Compensate if needed
		return fmt.Errorf("failed to assign task: %w", err)
	}

	// Step 4: Notify user (async)
	// This could be done via event publishing

	return nil
}

// Compensate rolls back the saga
func (s *TaskAssignmentSaga) Compensate(ctx context.Context, taskID string) error {
	// Implement compensation logic
	// e.g., unassign task, notify user of cancellation
	return nil
}
