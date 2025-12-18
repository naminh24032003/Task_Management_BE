package command

// CreateUserCommand represents a command to create new user
type CreateUserCommand struct {
	Email     string
	Password  string
	FirstName string
	LastName  string
}

// NewCreateUserCommand creates a new command
func NewCreateUserCommand(email, password, firstName, lastName string) *CreateUserCommand {
	return &CreateUserCommand{
		Email:     email,
		Password:  password,
		FirstName: firstName,
		LastName:  lastName,
	}
}
