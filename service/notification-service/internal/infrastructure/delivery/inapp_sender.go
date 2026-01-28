package delivery

import (
	"context"
	"log"

	"notification-service/internal/domain/notification"
	"notification-service/internal/ports"
)

// InAppSender sends in-app notifications via Kafka for BFF to consume
type InAppSender struct {
	producer  ports.EventProducer
	available bool
}

// NewInAppSender creates a new InAppSender
func NewInAppSender(producer ports.EventProducer) *InAppSender {
	return &InAppSender{
		producer:  producer,
		available: producer != nil,
	}
}

// Send sends an in-app notification
func (s *InAppSender) Send(ctx context.Context, n *notification.Notification) error {
	if !s.available {
		log.Printf("InApp sender not available, skipping notification %s", n.ID)
		return nil
	}

	// Create notification event for BFF to consume
	event := map[string]interface{}{
		"event_type":      "notification.created",
		"notification_id": n.ID,
		"user_id":         n.UserID,
		"type":            n.Type,
		"title":           n.Title,
		"body":            n.Body,
		"channel":         string(n.Channel),
		"priority":        string(n.Priority),
		"metadata":        n.Metadata,
		"source_event":    n.SourceEvent,
		"source_id":       n.SourceID,
		"created_at":      n.CreatedAt,
	}

	// Use user_id as partition key for ordering
	if err := s.producer.PublishEvent(ctx, n.UserID, event); err != nil {
		return err
	}

	log.Printf("InApp notification sent: %s to user %s", n.ID, n.UserID)
	return nil
}

// Channel returns the channel this sender handles
func (s *InAppSender) Channel() notification.Channel {
	return notification.ChannelInApp
}

// IsAvailable checks if the sender is available
func (s *InAppSender) IsAvailable() bool {
	return s.available
}
