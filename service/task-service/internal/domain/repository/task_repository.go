package repository

import (
	"context"
	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/valueobject"
	"time"
)

type TaskFilter struct {
	ProjectID   string
	SpaceID     string
	AssigneeIDs []string
	Statuses    []valueobject.TaskStatus
	Priorities  []valueobject.TaskPriority
	Tags        []string
	SearchQuery string
	DueDateFrom *time.Time
	DueDateTo   *time.Time
}

type TaskRepository interface {
	Create(ctx context.Context, task *aggregate.Task) error
	Update(ctx context.Context, task *aggregate.Task) error
	Delete(ctx context.Context, tenantID, id string) error
	FindByID(ctx context.Context, tenantID, id string) (*aggregate.Task, error)
	FindAll(ctx context.Context, tenantID string, page, pageSize int32, filter TaskFilter) ([]*aggregate.Task, int64, error)

	BulkUpdateStatus(ctx context.Context, tenantID string, ids []string, status valueobject.TaskStatus) (int32, []string, error)
	BulkAssign(ctx context.Context, tenantID string, ids []string, assigneeIDs []string) (int32, []string, error)
}
