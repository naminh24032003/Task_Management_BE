package command

import "time"

// CreateTaskCommand represents a command to create new task with full ClickUp fields
type CreateTaskCommand struct {
	TenantID     string
	Title        string
	Description  string
	Priority     int32
	ProjectID    string
	SpaceID      string
	CreatorID    string
	AssigneeIDs  []string
	DueDate      *time.Time
	StartDate    *time.Time
	TimeEstimate int32
	Tags         []string
	ParentTaskID string
	CustomFields map[string]string
}

// NewCreateTaskCommand creates a new command
func NewCreateTaskCommand(
	tenantID, title, description string,
	priority int32,
	projectID, spaceID, creatorID string,
	assigneeIDs []string,
	dueDate, startDate *time.Time,
	timeEstimate int32,
	tags []string,
	parentTaskID string,
	customFields map[string]string,
) *CreateTaskCommand {
	return &CreateTaskCommand{
		TenantID:     tenantID,
		Title:        title,
		Description:  description,
		Priority:     priority,
		ProjectID:    projectID,
		SpaceID:      spaceID,
		CreatorID:    creatorID,
		AssigneeIDs:  assigneeIDs,
		DueDate:      dueDate,
		StartDate:    startDate,
		TimeEstimate: timeEstimate,
		Tags:         tags,
		ParentTaskID: parentTaskID,
		CustomFields: customFields,
	}
}
