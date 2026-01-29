package handler

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"task-service/internal/application/command"
	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/event"
	"task-service/internal/domain/service"
	"task-service/internal/domain/valueobject"
	"task-service/internal/pkg/auth"
)

// UnitOfWork interface for transactional operations with outbox pattern
type UnitOfWork interface {
	CreateTaskWithEvents(ctx context.Context, task *aggregate.Task) error
	UpdateTaskWithEvents(ctx context.Context, task *aggregate.Task) error
	DeleteTaskWithEvents(ctx context.Context, tenantID, taskID string, deleteEvent event.DomainEvent) error
}

// TaskFinder interface for finding tasks (read-only)
type TaskFinder interface {
	FindByID(ctx context.Context, tenantID, id string) (*aggregate.Task, error)
}

// CommandHandlerOutbox handles all write operations using Outbox Pattern
// This replaces the original CommandHandler to ensure transactional consistency
type CommandHandlerOutbox struct {
	unitOfWork    UnitOfWork
	taskFinder    TaskFinder
	domainService *service.TaskDomainService
}

// NewCommandHandlerOutbox creates a new command handler with outbox support
func NewCommandHandlerOutbox(
	unitOfWork UnitOfWork,
	taskFinder TaskFinder,
	domainService *service.TaskDomainService,
) *CommandHandlerOutbox {
	return &CommandHandlerOutbox{
		unitOfWork:    unitOfWork,
		taskFinder:    taskFinder,
		domainService: domainService,
	}
}

// HandleCreateTask handles create task command with transactional outbox
func (h *CommandHandlerOutbox) HandleCreateTask(ctx context.Context, cmd *command.CreateTaskCommand) (string, error) {
	// Validate
	if err := h.domainService.ValidateTaskCreation(ctx, cmd.Title, cmd.ProjectID); err != nil {
		return "", err
	}

	// Create task aggregate
	taskID := uuid.New().String()
	task, err := aggregate.NewTask(taskID, cmd.TenantID, cmd.Title, cmd.CreatorID, cmd.ProjectID, cmd.SpaceID)
	if err != nil {
		return "", fmt.Errorf("failed to create task: %w", err)
	}

	// Set additional fields
	task.Description = cmd.Description
	task.Priority = valueobject.TaskPriority(cmd.Priority)
	task.DueDate = cmd.DueDate
	task.StartDate = cmd.StartDate
	task.TimeEstimateMinutes = cmd.TimeEstimate
	task.Tags = cmd.Tags
	task.ParentTaskID = cmd.ParentTaskID
	task.CustomFields = cmd.CustomFields
	task.AssigneeIDs = cmd.AssigneeIDs

	// Save task AND outbox entries in a single transaction
	// This ensures atomicity - either both succeed or both fail
	if err := h.unitOfWork.CreateTaskWithEvents(ctx, task); err != nil {
		return "", fmt.Errorf("failed to save task with events: %w", err)
	}

	return taskID, nil
}

// HandleUpdateTaskStatus handles update task status command with transactional outbox
func (h *CommandHandlerOutbox) HandleUpdateTaskStatus(ctx context.Context, cmd *command.UpdateTaskStatusCommand) error {
	task, err := h.taskFinder.FindByID(ctx, cmd.TenantID, cmd.ID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	identity := auth.GetIdentityFromContext(ctx)
	if err := h.domainService.AuthorizeWriteTask(ctx, identity, task); err != nil {
		return err
	}

	if err := task.UpdateStatus(valueobject.TaskStatus(cmd.Status)); err != nil {
		return err
	}

	// Update task AND outbox entries in a single transaction
	if err := h.unitOfWork.UpdateTaskWithEvents(ctx, task); err != nil {
		return fmt.Errorf("failed to update task with events: %w", err)
	}

	return nil
}

// HandleAssignTask handles assign task command with transactional outbox
func (h *CommandHandlerOutbox) HandleAssignTask(ctx context.Context, cmd *command.AssignTaskCommand) error {
	task, err := h.taskFinder.FindByID(ctx, cmd.TenantID, cmd.ID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	identity := auth.GetIdentityFromContext(ctx)
	if err := h.domainService.AuthorizeWriteTask(ctx, identity, task); err != nil {
		return err
	}

	task.Assign(cmd.AssigneeIDs)

	// Update task AND outbox entries in a single transaction
	if err := h.unitOfWork.UpdateTaskWithEvents(ctx, task); err != nil {
		return fmt.Errorf("failed to update task with events: %w", err)
	}

	return nil
}

// HandleDeleteTask handles delete task command with transactional outbox
func (h *CommandHandlerOutbox) HandleDeleteTask(ctx context.Context, cmd *command.DeleteTaskCommand) error {
	task, err := h.taskFinder.FindByID(ctx, cmd.TenantID, cmd.ID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	identity := auth.GetIdentityFromContext(ctx)
	if err := h.domainService.AuthorizeWriteTask(ctx, identity, task); err != nil {
		return err
	}

	// Create delete event
	deleteEvent := event.NewTaskDeletedEvent(cmd.ID, cmd.TenantID)

	// Delete task AND create outbox entry in a single transaction
	if err := h.unitOfWork.DeleteTaskWithEvents(ctx, cmd.TenantID, cmd.ID, deleteEvent); err != nil {
		return fmt.Errorf("failed to delete task with events: %w", err)
	}

	return nil
}
