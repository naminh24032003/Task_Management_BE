package handler

import (
	"context"
	"fmt"
	"log"

	"notification-service/internal/domain/event"
	"notification-service/internal/domain/notification"
)

// TaskAssignedHandler handles task assigned events
type TaskAssignedHandler struct {
	*BaseHandler
}

// NewTaskAssignedHandler creates a new TaskAssignedHandler
func NewTaskAssignedHandler(base *BaseHandler) *TaskAssignedHandler {
	return &TaskAssignedHandler{
		BaseHandler: base,
	}
}

// EventType returns the event type this handler processes
func (h *TaskAssignedHandler) EventType() string {
	return event.TaskAssignedEventType
}

// Handle processes a task assigned event
func (h *TaskAssignedHandler) Handle(ctx context.Context, data map[string]interface{}) error {
	log.Printf("Handling task.assigned event: %v", data["aggregate_id"])

	// Extract event data
	taskID := getStringValue(data, "aggregate_id", "")
	taskTitle := getStringValue(data, "task_title", "")
	newAssigneeID := getStringValue(data, "new_assignee_id", "")
	oldAssigneeID := getStringValue(data, "old_assignee_id", "")
	assignedBy := getStringValue(data, "assigned_by", "")
	projectID := getStringValue(data, "project_id", "")

	if taskID == "" {
		return fmt.Errorf("missing task_id in event data")
	}

	// Apply notification rule
	rule := notification.NewTaskAssignedRule()
	result, err := rule.Apply(ctx, event.TaskAssignedEventType, data)
	if err != nil {
		return fmt.Errorf("failed to apply rule: %w", err)
	}

	// Create notifications for each recipient
	for _, recipient := range result.Recipients {
		// Customize body based on recipient
		body := result.Body
		if recipient.UserID == oldAssigneeID {
			body = fmt.Sprintf("Task '%s' has been reassigned to another user", taskTitle)
		}

		notif := notification.NewNotificationBuilder().
			WithUserID(recipient.UserID).
			WithType("task_assigned").
			WithTitle(result.Title).
			WithBody(body).
			WithChannel(notification.ChannelInApp).
			WithPriority(result.Priority).
			WithSourceEvent(event.TaskAssignedEventType).
			WithSourceID(taskID).
			WithMetadata("task_id", taskID).
			WithMetadata("task_title", taskTitle).
			WithMetadata("project_id", projectID).
			WithMetadata("assigned_by", assignedBy).
			WithMetadata("old_assignee_id", oldAssigneeID).
			WithMetadata("new_assignee_id", newAssigneeID).
			Build()

		// Save notification
		if err := h.repo.Create(ctx, notif); err != nil {
			log.Printf("Failed to save notification: %v", err)
			continue
		}

		// Send through channels (higher priority for new assignee)
		channels := recipient.Channels
		if recipient.UserID == newAssigneeID {
			// For new assignee, send through all configured channels
			channels = notification.Channels{
				notification.ChannelInApp,
				notification.ChannelEmail,
				notification.ChannelPush,
			}
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
