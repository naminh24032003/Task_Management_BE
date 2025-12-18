package command

// CompleteTaskCommand represents a command to complete a task
type CompleteTaskCommand struct {
	TaskID string
}

// NewCompleteTaskCommand creates a new command
func NewCompleteTaskCommand(taskID string) *CompleteTaskCommand {
	return &CompleteTaskCommand{
		TaskID: taskID,
	}
}
