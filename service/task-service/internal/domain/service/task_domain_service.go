package service

import (
	"context"
	"errors"

	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/repository"
	"task-service/internal/domain/valueobject"
	"task-service/internal/pkg/auth"
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

// AuthorizeUpdateTaskStatus allows both lead and assignees to update status
func (s *TaskDomainService) AuthorizeUpdateTaskStatus(ctx context.Context, identity *auth.UserIdentity, task *aggregate.Task) error {
	if identity.HasRole("admin") {
		return nil
	}

	if !identity.HasScope("task:write") {
		return errors.New("access denied: missing task:write scope")
	}

	// Status check: non-admins cannot edit DONE tasks
	if task.Status == valueobject.TaskStatusComplete || task.Status == valueobject.TaskStatusClosed {
		return errors.New("access denied: cannot modify task in DONE status")
	}

	isOwner := task.CreatorID == identity.UserID
	isAssignee := false
	for _, id := range task.AssigneeIDs {
		if id == identity.UserID {
			isAssignee = true
			break
		}
	}

	if !isOwner && !isAssignee {
		return errors.New("access denied: must be owner or assignee to update task status")
	}

	return nil
}

// AuthorizeAssignTask only allows lead (owner) or admin to assign/reassign
func (s *TaskDomainService) AuthorizeAssignTask(ctx context.Context, identity *auth.UserIdentity, task *aggregate.Task) error {
	if identity.HasRole("admin") {
		return nil
	}

	if !identity.HasScope("task:write") {
		return errors.New("access denied: missing task:write scope")
	}

	if task.CreatorID != identity.UserID {
		return errors.New("access denied: only the task lead (creator) can assign users")
	}

	return nil
}

// AuthorizeDeleteTask only allows lead (owner) or admin to delete
func (s *TaskDomainService) AuthorizeDeleteTask(ctx context.Context, identity *auth.UserIdentity, task *aggregate.Task) error {
	if identity.HasRole("admin") {
		return nil
	}

	if !identity.HasScope("task:write") {
		return errors.New("access denied: missing task:write scope")
	}

	if task.CreatorID != identity.UserID {
		return errors.New("access denied: only the task lead (creator) can delete the task")
	}

	return nil
}

// AuthorizeWriteTask is kept for backward compatibility and general edits
func (s *TaskDomainService) AuthorizeWriteTask(ctx context.Context, identity *auth.UserIdentity, task *aggregate.Task) error {
	return s.AuthorizeUpdateTaskStatus(ctx, identity, task)
}
