package ports

import (
	"context"
)

// UserPreference contains user notification preferences
type UserPreference struct {
	UserID           string
	EmailEnabled     bool
	PushEnabled      bool
	InAppEnabled     bool
	SMSEnabled       bool
	MutedUntil       *string
	MutedProjectIDs  []string
	EmailAddress     string
	PhoneNumber      string
	PushToken        string
}

// UserService defines the interface for user-related operations
type UserService interface {
	// GetUserPreference gets notification preferences for a user
	GetUserPreference(ctx context.Context, userID string) (*UserPreference, error)

	// GetUsersByProjectID gets all users in a project
	GetUsersByProjectID(ctx context.Context, projectID string) ([]string, error)

	// GetUserEmail gets the email address for a user
	GetUserEmail(ctx context.Context, userID string) (string, error)

	// GetUserPushToken gets the push notification token for a user
	GetUserPushToken(ctx context.Context, userID string) (string, error)
}
