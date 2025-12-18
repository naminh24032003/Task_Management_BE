package query

// GetTaskQuery represents a query to get task by ID
type GetTaskQuery struct {
	TaskID string
}

// NewGetTaskQuery creates a new query
func NewGetTaskQuery(taskID string) *GetTaskQuery {
	return &GetTaskQuery{
		TaskID: taskID,
	}
}

// ListTasksQuery represents a query to list tasks with pagination
type ListTasksQuery struct {
	Offset     int
	Limit      int
	ProjectID  string
	AssigneeID string
	Status     string
}

// NewListTasksQuery creates a new query
func NewListTasksQuery(offset, limit int, projectID, assigneeID, status string) *ListTasksQuery {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return &ListTasksQuery{
		Offset:     offset,
		Limit:      limit,
		ProjectID:  projectID,
		AssigneeID: assigneeID,
		Status:     status,
	}
}

// GetTasksByProjectQuery represents a query to get tasks by project
type GetTasksByProjectQuery struct {
	ProjectID string
	Offset    int
	Limit     int
}

// NewGetTasksByProjectQuery creates a new query
func NewGetTasksByProjectQuery(projectID string, offset, limit int) *GetTasksByProjectQuery {
	return &GetTasksByProjectQuery{
		ProjectID: projectID,
		Offset:    offset,
		Limit:     limit,
	}
}
