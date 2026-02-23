package ports

import (
	"context"

	"notification-service/internal/domain/notification"
)

// NotificationRepository defines the interface for notification persistence
type NotificationRepository interface {
	// Create creates a new notification
	Create(ctx context.Context, n *notification.Notification) error

	// Update updates an existing notification
	Update(ctx context.Context, n *notification.Notification) error

	// FindByID finds a notification by ID
	FindByID(ctx context.Context, id string) (*notification.Notification, error)

	// FindByUserID finds all notifications for a user
	FindByUserID(ctx context.Context, userID string, limit, offset int) ([]*notification.Notification, error)

	// FindByUserIDWithCursor finds notifications for a user with cursor-based pagination
	FindByUserIDWithCursor(ctx context.Context, userID string, cursor string, limit int) ([]*notification.Notification, string, bool, error)

	// FindUnreadByUserID finds unread notifications for a user
	FindUnreadByUserID(ctx context.Context, userID string, limit, offset int) ([]*notification.Notification, error)

	// FindUnreadByUserIDWithCursor finds unread notifications for a user with cursor-based pagination
	FindUnreadByUserIDWithCursor(ctx context.Context, userID string, cursor string, limit int) ([]*notification.Notification, string, bool, error)

	// CountUnreadByUserID counts unread notifications for a user
	CountUnreadByUserID(ctx context.Context, userID string) (int64, error)

	// MarkAsRead marks a notification as read
	MarkAsRead(ctx context.Context, id string) error

	// MarkAllAsReadByUserID marks all notifications as read for a user
	MarkAllAsReadByUserID(ctx context.Context, userID string) error

	// Delete deletes a notification
	Delete(ctx context.Context, id string) error

	// DeleteByUserID deletes all notifications for a user
	DeleteByUserID(ctx context.Context, userID string) error
}

// NotificationFilter defines filter options for querying notifications
type NotificationFilter struct {
	UserID      string
	Type        string
	Channel     notification.Channel
	Status      notification.Status
	SourceEvent string
	Limit       int
	Offset      int
}
