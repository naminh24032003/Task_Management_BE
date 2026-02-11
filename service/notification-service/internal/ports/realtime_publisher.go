package ports

import (
	"context"

	"notification-service/internal/domain/notification"
)

// RealtimePublisher publishes notifications for real-time delivery via Redis Pub/Sub
type RealtimePublisher interface {
	// PublishNotification publishes a notification to the real-time channel
	PublishNotification(ctx context.Context, n *notification.Notification) error
}
