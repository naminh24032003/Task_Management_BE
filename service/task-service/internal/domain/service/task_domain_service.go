package service

import (
	"context"
	"errors"

	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/repository"
	"task-service/internal/domain/valueobject"
)

// TaskDomainService contains domain logic that doesn't fit into a single aggregate
type TaskDomainService struct {
	taskRepo repository.TaskRepository
}

// NewTaskDomainService creates a new domain service
func NewTaskDomainService(taskRepo repository.TaskRepository) *TaskDomainService {
	return &TaskDomainService{
		taskRepo: taskRepo,
	}
}

// CanAssignTask checks if a task can be assigned
func (s *TaskDomainService) CanAssignTask(ctx context.Context, task *aggregate.Task, assigneeID string) error {
	if task.Status == valueobject.TaskStatusComplete || task.Status == valueobject.TaskStatusClosed {
		return errors.New("cannot assign completed or closed task")
	}

	if task.Status == valueobject.TaskStatusCancelled {
		return errors.New("cannot assign cancelled task")
	}

	return nil
}

// CanCompleteTask checks if a task can be completed
func (s *TaskDomainService) CanCompleteTask(ctx context.Context, task *aggregate.Task) error {
	if task.Status == valueobject.TaskStatusComplete || task.Status == valueobject.TaskStatusClosed {
		return errors.New("task is already completed or closed")
	}

	if task.Status == valueobject.TaskStatusCancelled {
		return errors.New("cannot complete cancelled task")
	}

	return nil
}

// ValidateTaskCreation validates task creation rules
func (s *TaskDomainService) ValidateTaskCreation(ctx context.Context, title, projectID string) error {
	if title == "" {
		return errors.New("task title cannot be empty")
	}

	if projectID == "" {
		return errors.New("project ID cannot be empty")
	}

	return nil
}
