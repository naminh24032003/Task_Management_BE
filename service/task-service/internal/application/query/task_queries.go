package query

import "task-service/internal/domain/valueobject"

// GetTaskQuery represents a query to get task by ID
type GetTaskQuery struct {
	ID       string
	TenantID string
}

// ListTasksQuery represents a query to list tasks with full filtering
type ListTasksQuery struct {
	TenantID    string
	Page        int32
	PageSize    int32
	ProjectID   string
	SpaceID     string
	AssigneeIDs []string
	Statuses    []valueobject.TaskStatus
	Priorities  []valueobject.TaskPriority
	Tags        []string
	SearchQuery string
	SortBy      string
	SortDesc    bool
}

// GetTasksByProjectQuery represents a query to get tasks by project
type GetTasksByProjectQuery struct {
	TenantID  string
	ProjectID string
	Page      int32
	PageSize  int32
	Statuses  []valueobject.TaskStatus
}
