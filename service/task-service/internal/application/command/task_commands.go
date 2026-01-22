package command

// UpdateTaskStatusCommand represents a command to update task status
type UpdateTaskStatusCommand struct {
	ID        string
	TenantID  string
	Status    int32
	UpdatedBy string
}

// AssignTaskCommand represents a command to assign task to users
type AssignTaskCommand struct {
	ID          string
	TenantID    string
	AssigneeIDs []string
	AssignedBy  string
}

// DeleteTaskCommand represents a command to delete a task
type DeleteTaskCommand struct {
	ID        string
	TenantID  string
	DeletedBy string
}

// UpdateTaskCommand represents a command to update multiple task fields
type UpdateTaskCommand struct {
	ID           string
	TenantID     string
	Title        *string
	Description  *string
	TimeEstimate *int32
	DueDate      *string
	StartDate    *string
	Tags         []string
	ParentTaskID *string
	CustomFields map[string]string
}
