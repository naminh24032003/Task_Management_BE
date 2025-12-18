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

	// Parse priority
	priority := valueobject.ParsePriority(cmd.Priority)

	// Create task aggregate
	taskID := uuid.New().String()
	task, err := aggregate.NewTask(taskID, cmd.Title, cmd.Description, cmd.ProjectID, priority, cmd.DueDate)
	if err != nil {
		return "", fmt.Errorf("failed to create task: %w", err)
	}

	// Save to repository
	if err := h.taskRepo.Create(ctx, task); err != nil {
		return "", fmt.Errorf("failed to save task: %w", err)
	}

	// Publish domain events
	h.publishEvents(ctx, task)

	return taskID, nil
}

// HandleAssignTask handles assign task command
func (h *CommandHandler) HandleAssignTask(ctx context.Context, cmd *command.AssignTaskCommand) error {
	// Load task aggregate
	task, err := h.taskRepo.FindByID(ctx, cmd.TaskID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	// Check domain rules
	if err := h.domainService.CanAssignTask(ctx, task, cmd.AssigneeID); err != nil {
		return err
	}

	// Execute domain logic
	if err := task.Assign(cmd.AssigneeID); err != nil {
		return err
	}

	// Save changes
	if err := h.taskRepo.Update(ctx, task); err != nil {
		return fmt.Errorf("failed to update task: %w", err)
	}

	// Publish events
	h.publishEvents(ctx, task)

	return nil
}

// HandleCompleteTask handles complete task command
func (h *CommandHandler) HandleCompleteTask(ctx context.Context, cmd *command.CompleteTaskCommand) error {
	// Load task aggregate
	task, err := h.taskRepo.FindByID(ctx, cmd.TaskID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	// Check domain rules
	if err := h.domainService.CanCompleteTask(ctx, task); err != nil {
		return err
	}

	// Execute domain logic
	if err := task.Complete(); err != nil {
		return err
	}

	// Save changes
	if err := h.taskRepo.Update(ctx, task); err != nil {
		return fmt.Errorf("failed to update task: %w", err)
	}

	// Publish events
	h.publishEvents(ctx, task)

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
