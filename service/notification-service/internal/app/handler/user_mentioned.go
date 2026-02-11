package handler

import (
	"context"
	"fmt"
	"log"

	"notification-service/internal/domain/event"
	"notification-service/internal/domain/notification"
)

// UserMentionedHandler handles user mentioned events
type UserMentionedHandler struct {
	*BaseHandler
}

// NewUserMentionedHandler creates a new UserMentionedHandler
func NewUserMentionedHandler(base *BaseHandler) *UserMentionedHandler {
	return &UserMentionedHandler{
		BaseHandler: base,
	}
}

// EventType returns the event type this handler processes
func (h *UserMentionedHandler) EventType() string {
	return event.UserMentionedEventType
}

// Handle processes a user mentioned event
func (h *UserMentionedHandler) Handle(ctx context.Context, data map[string]interface{}) error {
	log.Printf("Handling user.mentioned event: %v", data["aggregate_id"])

	// Extract event data
	taskID := getStringValue(data, "aggregate_id", "")
	taskTitle := getStringValue(data, "task_title", "")
	mentionedBy := getStringValue(data, "mentioned_by", "")
	commentID := getStringValue(data, "comment_id", "")
	commentText := getStringValue(data, "comment_text", "")
	projectID := getStringValue(data, "project_id", "")

	if taskID == "" {
		return fmt.Errorf("missing task_id in event data")
	}

	// Apply notification rule
	rule := notification.NewUserMentionedRule()
	result, err := rule.Apply(ctx, event.UserMentionedEventType, data)
	if err != nil {
		return fmt.Errorf("failed to apply rule: %w", err)
	}

	// Create notifications for each recipient
	for _, recipient := range result.Recipients {
		// Customize body with mentioner's name
		body := fmt.Sprintf("%s mentioned you in task '%s'", mentionedBy, taskTitle)

		notif := notification.NewNotificationBuilder().
			WithUserID(recipient.UserID).
			WithType("user_mentioned").
			WithTitle(result.Title).
			WithBody(body).
			WithChannel(notification.ChannelInApp).
			WithPriority(result.Priority).
			WithSourceEvent(event.UserMentionedEventType).
			WithSourceID(taskID).
			WithMetadata("task_id", taskID).
			WithMetadata("task_title", taskTitle).
			WithMetadata("project_id", projectID).
			WithMetadata("mentioned_by", mentionedBy).
			WithMetadata("comment_id", commentID).
			WithMetadata("comment_text", commentText).
			Build()

		// Save notification
		if err := h.repo.Create(ctx, notif); err != nil {
			log.Printf("Failed to save notification: %v", err)
			continue
		}

		// Mentions are high priority - send through multiple channels
		channels := notification.Channels{
			notification.ChannelInApp,
			notification.ChannelEmail,
			notification.ChannelPush,
		}

		for _, channel := range channels {
			notif.Channel = channel
			if sender, ok := h.multiSender.GetSender(channel); ok && sender.IsAvailable() {
				if err := sender.Send(ctx, notif); err != nil {
					log.Printf("Failed to send notification via %s: %v", channel, err)
				}
			}
		}

		notif.MarkAsSent()
		h.repo.Update(ctx, notif)

		// Publish to Redis Pub/Sub for real-time delivery to BFF → WebSocket
		if h.realtimePublisher != nil {
			if err := h.realtimePublisher.PublishNotification(ctx, notif); err != nil {
				log.Printf("Failed to publish notification to Redis Pub/Sub: %v", err)
			}
		}
	}

	return nil
}
