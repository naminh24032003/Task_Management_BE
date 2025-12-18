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
func (h *QueryHandler) HandleGetTask(ctx context.Context, qry *query.GetTaskQuery) (*aggregate.Task, error) {
	task, err := h.taskRepo.FindByID(ctx, qry.TaskID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}
	return task, nil
}

// HandleListTasks handles list tasks query
func (h *QueryHandler) HandleListTasks(ctx context.Context, qry *query.ListTasksQuery) ([]*aggregate.Task, error) {
	// Apply filters based on query
	if qry.ProjectID != "" {
		return h.taskRepo.FindByProjectID(ctx, qry.ProjectID, qry.Offset, qry.Limit)
	}

	if qry.AssigneeID != "" {
		return h.taskRepo.FindByAssigneeID(ctx, qry.AssigneeID, qry.Offset, qry.Limit)
	}

	if qry.Status != "" {
		return h.taskRepo.FindByStatus(ctx, qry.Status, qry.Offset, qry.Limit)
	}

	return h.taskRepo.List(ctx, qry.Offset, qry.Limit)
}

// HandleGetTasksByProject handles get tasks by project query
func (h *QueryHandler) HandleGetTasksByProject(ctx context.Context, qry *query.GetTasksByProjectQuery) ([]*aggregate.Task, error) {
	tasks, err := h.taskRepo.FindByProjectID(ctx, qry.ProjectID, qry.Offset, qry.Limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}
	return tasks, nil
}
