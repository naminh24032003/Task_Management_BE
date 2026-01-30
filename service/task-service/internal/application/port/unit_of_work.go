package port

import (
	"context"

	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/event"
)

// UnitOfWork interface for transactional operations with outbox pattern
// This ensures atomicity - either both task and outbox entries succeed or both fail
type UnitOfWork interface {
	CreateTaskWithEvents(ctx context.Context, task *aggregate.Task) error
	UpdateTaskWithEvents(ctx context.Context, task *aggregate.Task) error
	DeleteTaskWithEvents(ctx context.Context, tenantID, taskID string, deleteEvent event.DomainEvent) error
}

// TaskFinder interface for finding tasks (read-only operations)
// Separated from UnitOfWork to follow Interface Segregation Principle
type TaskFinder interface {
	FindByID(ctx context.Context, tenantID, id string) (*aggregate.Task, error)
}
