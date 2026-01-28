package handler

import (
	"context"
	"fmt"
	"log"

	"notification-service/internal/domain/event"
	"notification-service/internal/domain/notification"
)

// TaskCompletedHandler handles task completed events
type TaskCompletedHandler struct {
	*BaseHandler
}

// NewTaskCompletedHandler creates a new TaskCompletedHandler
func NewTaskCompletedHandler(base *BaseHandler) *TaskCompletedHandler {
	return &TaskCompletedHandler{
		BaseHandler: base,
	}
}

// EventType returns the event type this handler processes
func (h *TaskCompletedHandler) EventType() string {
	return event.TaskCompletedEventType
}

// Handle processes a task completed event
func (h *TaskCompletedHandler) Handle(ctx context.Context, data map[string]interface{}) error {
	log.Printf("Handling task.completed event: %v", data["aggregate_id"])

	// Extract event data
	taskID := getStringValue(data, "aggregate_id", "")
	taskTitle := getStringValue(data, "task_title", "")
	completedBy := getStringValue(data, "completed_by", "")
	projectID := getStringValue(data, "project_id", "")

	if taskID == "" {
		return fmt.Errorf("missing task_id in event data")
	}

	// Apply notification rule
	rule := notification.NewTaskCompletedRule()
	result, err := rule.Apply(ctx, event.TaskCompletedEventType, data)
	if err != nil {
		return fmt.Errorf("failed to apply rule: %w", err)
	}

	// Create notifications for each recipient
	for _, recipient := range result.Recipients {
		notif := notification.NewNotificationBuilder().
			WithUserID(recipient.UserID).
			WithType("task_completed").
			WithTitle(result.Title).
			WithBody(result.Body).
			WithChannel(notification.ChannelInApp).
			WithPriority(result.Priority).
			WithSourceEvent(event.TaskCompletedEventType).
			WithSourceID(taskID).
			WithMetadata("task_id", taskID).
			WithMetadata("task_title", taskTitle).
			WithMetadata("project_id", projectID).
			WithMetadata("completed_by", completedBy).
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
	}

	return nil
}
