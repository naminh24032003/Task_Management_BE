package command

// DisableUserCommand represents a command to disable a user
type DisableUserCommand struct {
	UserID string
}

// NewDisableUserCommand creates a new command
func NewDisableUserCommand(userID string) *DisableUserCommand {
	return &DisableUserCommand{
		UserID: userID,
	}
}
