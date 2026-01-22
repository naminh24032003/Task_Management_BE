package handler

import (
	"context"
	"fmt"

	"task-service/internal/application/query"
	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/repository"
)

// QueryHandler handles all read operations (Queries)
type QueryHandler struct {
	taskRepo repository.TaskRepository
}

// NewQueryHandler creates a new query handler
func NewQueryHandler(taskRepo repository.TaskRepository) *QueryHandler {
	return &QueryHandler{
		taskRepo: taskRepo,
	}
}

// HandleGetTask handles get task query
func (h *QueryHandler) HandleGetTask(ctx context.Context, q *query.GetTaskQuery) (*aggregate.Task, error) {
	task, err := h.taskRepo.FindByID(ctx, q.TenantID, q.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to find task: %w", err)
	}
	return task, nil
}

// HandleListTasks handles list tasks query
func (h *QueryHandler) HandleListTasks(ctx context.Context, q *query.ListTasksQuery) ([]*aggregate.Task, int64, error) {
	filter := repository.TaskFilter{
		ProjectID:   q.ProjectID,
		SpaceID:     q.SpaceID,
		AssigneeIDs: q.AssigneeIDs,
		Statuses:    q.Statuses,
		Priorities:  q.Priorities,
		Tags:        q.Tags,
		SearchQuery: q.SearchQuery,
	}

	return h.taskRepo.FindAll(ctx, q.TenantID, q.Page, q.PageSize, filter)
}

// HandleGetTasksByProject handles get tasks by project query
func (h *QueryHandler) HandleGetTasksByProject(ctx context.Context, q *query.GetTasksByProjectQuery) ([]*aggregate.Task, int64, error) {
	filter := repository.TaskFilter{
		ProjectID: q.ProjectID,
		Statuses:  q.Statuses,
	}

	return h.taskRepo.FindAll(ctx, q.TenantID, q.Page, q.PageSize, filter)
}
