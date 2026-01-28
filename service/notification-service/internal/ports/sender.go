package ports

import (
	"context"

	"notification-service/internal/domain/notification"
)

// NotificationSender defines the interface for sending notifications
type NotificationSender interface {
	// Send sends a notification through the specific channel
	Send(ctx context.Context, n *notification.Notification) error

	// Channel returns the channel this sender handles
	Channel() notification.Channel

	// IsAvailable checks if the sender is available/configured
	IsAvailable() bool
}

// SendResult contains the result of sending a notification
type SendResult struct {
	Success      bool
	Channel      notification.Channel
	Error        error
	DeliveryID   string
	DeliveredAt  string
}

// MultiChannelSender sends notifications through multiple channels
type MultiChannelSender interface {
	// SendToChannels sends a notification through specified channels
	SendToChannels(ctx context.Context, n *notification.Notification, channels []notification.Channel) []SendResult

	// RegisterSender registers a sender for a specific channel
	RegisterSender(sender NotificationSender)

	// GetSender returns the sender for a specific channel
	GetSender(channel notification.Channel) (NotificationSender, bool)
}
