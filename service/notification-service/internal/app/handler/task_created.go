package handler

import (
	"context"
	"fmt"
	"log"

	"notification-service/internal/domain/event"
	"notification-service/internal/domain/notification"
)

// TaskCreatedHandler handles task created events
type TaskCreatedHandler struct {
	*BaseHandler
}

// NewTaskCreatedHandler creates a new TaskCreatedHandler
func NewTaskCreatedHandler(base *BaseHandler) *TaskCreatedHandler {
	return &TaskCreatedHandler{
		BaseHandler: base,
	}
}

// EventType returns the event type this handler processes
func (h *TaskCreatedHandler) EventType() string {
	return event.TaskCreatedEventType
}

// Handle processes a task created event
func (h *TaskCreatedHandler) Handle(ctx context.Context, data map[string]interface{}) error {
	log.Printf("Handling task.created event: %v", data["aggregate_id"])

	// Extract event data
	taskID := getStringValue(data, "aggregate_id", "")
	title := getStringValue(data, "title", "")
	projectID := getStringValue(data, "project_id", "")
	creatorID := getStringValue(data, "creator_id", "")

	if taskID == "" {
		return fmt.Errorf("missing task_id in event data")
	}

	// Apply notification rule
	rule := notification.NewTaskCreatedRule()
	result, err := rule.Apply(ctx, event.TaskCreatedEventType, data)
	if err != nil {
		return fmt.Errorf("failed to apply rule: %w", err)
	}

	// Create notifications for each recipient
	for _, recipient := range result.Recipients {
		notif := notification.NewNotificationBuilder().
			WithUserID(recipient.UserID).
			WithType("task_created").
			WithTitle(result.Title).
			WithBody(result.Body).
			WithChannel(notification.ChannelInApp).
			WithPriority(result.Priority).
			WithSourceEvent(event.TaskCreatedEventType).
			WithSourceID(taskID).
			WithMetadata("task_id", taskID).
			WithMetadata("task_title", title).
			WithMetadata("project_id", projectID).
			WithMetadata("creator_id", creatorID).
			Build()

		// Save notification
		if err := h.repo.Create(ctx, notif); err != nil {
			log.Printf("Failed to save notification: %v", err)
			continue
		}

		// Send through channels
		for _, channel := range recipient.Channels {
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
