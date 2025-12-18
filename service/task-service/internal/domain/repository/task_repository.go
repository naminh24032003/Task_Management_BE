package repository

import (
	"context"

	"task-service/internal/domain/aggregate"
)

// TaskRepository defines the interface for task persistence
// This is a PORT in Hexagonal Architecture
type TaskRepository interface {
	// Create saves a new task
	Create(ctx context.Context, task *aggregate.Task) error

	// FindByID finds a task by ID
	FindByID(ctx context.Context, id string) (*aggregate.Task, error)

	// Update updates an existing task
	Update(ctx context.Context, task *aggregate.Task) error

	// Delete deletes a task
	Delete(ctx context.Context, id string) error

	// List returns a paginated list of tasks
	List(ctx context.Context, offset, limit int) ([]*aggregate.Task, error)

	// FindByProjectID finds tasks by project ID
	FindByProjectID(ctx context.Context, projectID string, offset, limit int) ([]*aggregate.Task, error)

	// FindByAssigneeID finds tasks by assignee ID
	FindByAssigneeID(ctx context.Context, assigneeID string, offset, limit int) ([]*aggregate.Task, error)

	// FindByStatus finds tasks by status
	FindByStatus(ctx context.Context, status string, offset, limit int) ([]*aggregate.Task, error)
}
