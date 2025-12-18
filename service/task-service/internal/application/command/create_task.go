package command

import "time"

// CreateTaskCommand represents a command to create new task
type CreateTaskCommand struct {
	Title       string
	Description string
	Priority    string
	ProjectID   string
	DueDate     *time.Time
}

// NewCreateTaskCommand creates a new command
func NewCreateTaskCommand(title, description, priority, projectID string, dueDate *time.Time) *CreateTaskCommand {
	return &CreateTaskCommand{
		Title:       title,
		Description: description,
		Priority:    priority,
		ProjectID:   projectID,
		DueDate:     dueDate,
	}
}
