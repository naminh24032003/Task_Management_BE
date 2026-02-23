package handler

import (
	"context"
	"fmt"
	"time"

	"task-service/internal/application/port"
	"task-service/internal/application/query"
	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/repository"
)

const queryCacheTTL = 10 * time.Minute

// ListTasksResult holds the result of listing tasks (supports both offset and cursor pagination)
type ListTasksResult struct {
	Tasks      []*aggregate.Task
	Total      int64
	NextCursor string
	HasMore    bool
}

// QueryHandler handles all read operations (Queries)
type QueryHandler struct {
	taskRepo repository.TaskRepository
	cache    port.TaskCache // nil-safe
}

// NewQueryHandler creates a new query handler
func NewQueryHandler(taskRepo repository.TaskRepository, cache port.TaskCache) *QueryHandler {
	return &QueryHandler{
		taskRepo: taskRepo,
		cache:    cache,
	}
}

// HandleGetTask handles get task query.
// Flow: L1 NearCache → L2 Redis Lua → SingleFlight → DB → backfill L1+L2.
func (h *QueryHandler) HandleGetTask(ctx context.Context, q *query.GetTaskQuery) (*aggregate.Task, error) {
	// 1. Try L1 + L2 cache
	if h.cache != nil {
		if cached, err := h.cache.GetTask(ctx, q.TenantID, q.ID); err == nil && cached != nil {
			return cached, nil
		}
	}

	// 2. L1+L2 miss → SingleFlight wraps DB call (dedup concurrent fetches)
	sfKey := fmt.Sprintf("sf:%s:%s", q.TenantID, q.ID)
	loadFromDB := func() (*aggregate.Task, error) {
		task, err := h.taskRepo.FindByID(ctx, q.TenantID, q.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to find task: %w", err)
		}
		// 3. Backfill L1+L2 on DB hit
		if h.cache != nil && task != nil {
			_ = h.cache.SetTask(ctx, q.TenantID, q.ID, task, queryCacheTTL)
		}
		return task, nil
	}

	if h.cache != nil {
		return h.cache.SingleFlightDo(sfKey, loadFromDB)
	}
	return loadFromDB()
}

// HandleListTasks handles list tasks query with both offset and cursor pagination
func (h *QueryHandler) HandleListTasks(ctx context.Context, q *query.ListTasksQuery) (*ListTasksResult, error) {
	filter := repository.TaskFilter{
		ProjectID:   q.ProjectID,
		SpaceID:     q.SpaceID,
		AssigneeIDs: q.AssigneeIDs,
		Statuses:    q.Statuses,
		Priorities:  q.Priorities,
		Tags:        q.Tags,
		SearchQuery: q.SearchQuery,
	}

	if q.IsCursorBased() {
		cursorResult, err := h.taskRepo.FindAllWithCursor(ctx, q.TenantID, q.Cursor, q.Limit, filter, q.SortBy, q.SortDesc)
		if err != nil {
			return nil, fmt.Errorf("failed to list tasks with cursor: %w", err)
		}
		return &ListTasksResult{
			Tasks:      cursorResult.Tasks,
			Total:      cursorResult.TotalCount,
			NextCursor: cursorResult.NextCursor,
			HasMore:    cursorResult.HasMore,
		}, nil
	}

	tasks, total, err := h.taskRepo.FindAll(ctx, q.TenantID, q.Page, q.PageSize, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}
	return &ListTasksResult{
		Tasks: tasks,
		Total: total,
	}, nil
}

// HandleGetTasksByProject handles get tasks by project query
func (h *QueryHandler) HandleGetTasksByProject(ctx context.Context, q *query.GetTasksByProjectQuery) (*ListTasksResult, error) {
	filter := repository.TaskFilter{
		ProjectID: q.ProjectID,
		Statuses:  q.Statuses,
	}

	if q.IsCursorBased() {
		cursorResult, err := h.taskRepo.FindAllWithCursor(ctx, q.TenantID, q.Cursor, q.Limit, filter, "", true)
		if err != nil {
			return nil, fmt.Errorf("failed to list tasks by project with cursor: %w", err)
		}
		return &ListTasksResult{
			Tasks:      cursorResult.Tasks,
			Total:      cursorResult.TotalCount,
			NextCursor: cursorResult.NextCursor,
			HasMore:    cursorResult.HasMore,
		}, nil
	}

	tasks, total, err := h.taskRepo.FindAll(ctx, q.TenantID, q.Page, q.PageSize, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks by project: %w", err)
	}
	return &ListTasksResult{
		Tasks: tasks,
		Total: total,
	}, nil
}
