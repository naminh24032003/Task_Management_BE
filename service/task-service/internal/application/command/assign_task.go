package command

// AssignTaskCommand represents a command to assign a task to a user
type AssignTaskCommand struct {
	TaskID     string
	AssigneeID string
}

// NewAssignTaskCommand creates a new command
func NewAssignTaskCommand(taskID, assigneeID string) *AssignTaskCommand {
	return &AssignTaskCommand{
		TaskID:     taskID,
		AssigneeID: assigneeID,
	}
}
