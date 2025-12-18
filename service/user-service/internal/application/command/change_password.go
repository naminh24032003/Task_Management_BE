package command

// ChangePasswordCommand represents a command to change password
type ChangePasswordCommand struct {
	UserID      string
	OldPassword string
	NewPassword string
}

// NewChangePasswordCommand creates a new command
func NewChangePasswordCommand(userID, oldPassword, newPassword string) *ChangePasswordCommand {
	return &ChangePasswordCommand{
		UserID:      userID,
		OldPassword: oldPassword,
		NewPassword: newPassword,
	}
}
