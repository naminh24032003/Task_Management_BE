package event

import "time"

// NotificationCreatedEvent is published when a notification is created
type NotificationCreatedEvent struct {
	Type           string    `json:"event_type"`
	OccurredAt     time.Time `json:"occurred_at"`
	NotificationID string    `json:"aggregate_id"`
	UserID         string    `json:"user_id"`
	Title          string    `json:"title"`
	Body           string    `json:"body"`
	Channel        string    `json:"channel"`
	Priority       string    `json:"priority"`
	Metadata       map[string]interface{} `json:"metadata"`
}

func (e NotificationCreatedEvent) EventType() string    { return e.Type }
func (e NotificationCreatedEvent) OccurredOn() time.Time { return e.OccurredAt }
func (e NotificationCreatedEvent) AggregateID() string   { return e.NotificationID }

// NewNotificationCreatedEvent creates a new NotificationCreatedEvent
func NewNotificationCreatedEvent(
	notificationID, userID, title, body, channel, priority string,
	metadata map[string]interface{},
) NotificationCreatedEvent {
	return NotificationCreatedEvent{
		Type:           NotificationCreatedEventType,
		OccurredAt:     time.Now(),
		NotificationID: notificationID,
		UserID:         userID,
		Title:          title,
		Body:           body,
		Channel:        channel,
		Priority:       priority,
		Metadata:       metadata,
	}
}

// NotificationSentEvent is published when a notification is successfully sent
type NotificationSentEvent struct {
	Type           string    `json:"event_type"`
	OccurredAt     time.Time `json:"occurred_at"`
	NotificationID string    `json:"aggregate_id"`
	UserID         string    `json:"user_id"`
	Channel        string    `json:"channel"`
	SentAt         time.Time `json:"sent_at"`
}

func (e NotificationSentEvent) EventType() string    { return e.Type }
func (e NotificationSentEvent) OccurredOn() time.Time { return e.OccurredAt }
func (e NotificationSentEvent) AggregateID() string   { return e.NotificationID }

// Notification event type constants
const (
	NotificationCreatedEventType = "notification.created"
	NotificationSentEventType    = "notification.sent"
)
