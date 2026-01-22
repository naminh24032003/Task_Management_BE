package handler

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"task-service/internal/application/command"
	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/repository"
	"task-service/internal/domain/service"
	"task-service/internal/domain/valueobject"
)

// CommandHandler handles all write operations (Commands)
type CommandHandler struct {
	taskRepo       repository.TaskRepository
	domainService  *service.TaskDomainService
	eventPublisher EventPublisher
}

// EventPublisher interface for publishing domain events
type EventPublisher interface {
	Publish(ctx context.Context, events []interface{}) error
}

// NewCommandHandler creates a new command handler
func NewCommandHandler(
	taskRepo repository.TaskRepository,
	domainService *service.TaskDomainService,
	eventPublisher EventPublisher,
) *CommandHandler {
	return &CommandHandler{
		taskRepo:       taskRepo,
		domainService:  domainService,
		eventPublisher: eventPublisher,
	}
}

// HandleCreateTask handles create task command
func (h *CommandHandler) HandleCreateTask(ctx context.Context, cmd *command.CreateTaskCommand) (string, error) {
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

	// Save to repository
	if err := h.taskRepo.Create(ctx, task); err != nil {
		return "", fmt.Errorf("failed to save task: %w", err)
	}

	// Publish domain events
	h.publishEvents(ctx, task)

	return taskID, nil
}

// HandleUpdateTaskStatus handles update task status command
func (h *CommandHandler) HandleUpdateTaskStatus(ctx context.Context, cmd *command.UpdateTaskStatusCommand) error {
	task, err := h.taskRepo.FindByID(ctx, cmd.TenantID, cmd.ID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	if err := h.domainService.CanCompleteTask(ctx, task); err != nil {
		// Only check if completing/closing, but for now simple check
	}

	if err := task.UpdateStatus(valueobject.TaskStatus(cmd.Status)); err != nil {
		return err
	}

	if err := h.taskRepo.Update(ctx, task); err != nil {
		return fmt.Errorf("failed to update task: %w", err)
	}

	h.publishEvents(ctx, task)
	return nil
}

// HandleAssignTask handles assign task command
func (h *CommandHandler) HandleAssignTask(ctx context.Context, cmd *command.AssignTaskCommand) error {
	task, err := h.taskRepo.FindByID(ctx, cmd.TenantID, cmd.ID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	task.Assign(cmd.AssigneeIDs)

	if err := h.taskRepo.Update(ctx, task); err != nil {
		return fmt.Errorf("failed to update task: %w", err)
	}

	h.publishEvents(ctx, task)
	return nil
}

// HandleDeleteTask handles delete task command
func (h *CommandHandler) HandleDeleteTask(ctx context.Context, cmd *command.DeleteTaskCommand) error {
	if err := h.taskRepo.Delete(ctx, cmd.TenantID, cmd.ID); err != nil {
		return fmt.Errorf("failed to delete task: %w", err)
	}

	// Publish delete event
	return nil
}

func (h *CommandHandler) publishEvents(ctx context.Context, task *aggregate.Task) {
	if h.eventPublisher != nil {
		events := make([]interface{}, len(task.DomainEvents()))
		for i, event := range task.DomainEvents() {
			events[i] = event
		}
		if err := h.eventPublisher.Publish(ctx, events); err != nil {
			fmt.Printf("failed to publish events: %v\n", err)
		}
		task.ClearDomainEvents()
	}
}
