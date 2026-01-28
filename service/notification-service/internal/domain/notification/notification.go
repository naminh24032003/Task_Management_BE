package notification

import (
	"time"

	"github.com/google/uuid"
)

// Status represents the notification status
type Status string

const (
	StatusPending   Status = "pending"
	StatusSent      Status = "sent"
	StatusFailed    Status = "failed"
	StatusRead      Status = "read"
)

// Priority represents the notification priority
type Priority string

const (
	PriorityLow    Priority = "low"
	PriorityNormal Priority = "normal"
	PriorityHigh   Priority = "high"
	PriorityUrgent Priority = "urgent"
)

// Notification represents a notification entity
type Notification struct {
	ID           string                 `json:"id" bson:"_id"`
	UserID       string                 `json:"user_id" bson:"user_id"`
	Type         string                 `json:"type" bson:"type"`
	Title        string                 `json:"title" bson:"title"`
	Body         string                 `json:"body" bson:"body"`
	Channel      Channel                `json:"channel" bson:"channel"`
	Status       Status                 `json:"status" bson:"status"`
	Priority     Priority               `json:"priority" bson:"priority"`
	Metadata     map[string]interface{} `json:"metadata" bson:"metadata"`
	SourceEvent  string                 `json:"source_event" bson:"source_event"`
	SourceID     string                 `json:"source_id" bson:"source_id"`
	ReadAt       *time.Time             `json:"read_at,omitempty" bson:"read_at,omitempty"`
	SentAt       *time.Time             `json:"sent_at,omitempty" bson:"sent_at,omitempty"`
	FailedAt     *time.Time             `json:"failed_at,omitempty" bson:"failed_at,omitempty"`
	FailedReason string                 `json:"failed_reason,omitempty" bson:"failed_reason,omitempty"`
	CreatedAt    time.Time              `json:"created_at" bson:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at" bson:"updated_at"`
}

// NewNotification creates a new notification
func NewNotification(
	userID string,
	notificationType string,
	title string,
	body string,
	channel Channel,
	priority Priority,
	sourceEvent string,
	sourceID string,
	metadata map[string]interface{},
) *Notification {
	now := time.Now()
	return &Notification{
		ID:          uuid.New().String(),
		UserID:      userID,
		Type:        notificationType,
		Title:       title,
		Body:        body,
		Channel:     channel,
		Status:      StatusPending,
		Priority:    priority,
		Metadata:    metadata,
		SourceEvent: sourceEvent,
		SourceID:    sourceID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// MarkAsSent marks the notification as sent
func (n *Notification) MarkAsSent() {
	now := time.Now()
	n.Status = StatusSent
	n.SentAt = &now
	n.UpdatedAt = now
}

// MarkAsFailed marks the notification as failed
func (n *Notification) MarkAsFailed(reason string) {
	now := time.Now()
	n.Status = StatusFailed
	n.FailedAt = &now
	n.FailedReason = reason
	n.UpdatedAt = now
}

// MarkAsRead marks the notification as read
func (n *Notification) MarkAsRead() {
	now := time.Now()
	n.Status = StatusRead
	n.ReadAt = &now
	n.UpdatedAt = now
}

// NotificationBuilder is a builder for creating notifications
type NotificationBuilder struct {
	notification *Notification
}

// NewNotificationBuilder creates a new notification builder
func NewNotificationBuilder() *NotificationBuilder {
	return &NotificationBuilder{
		notification: &Notification{
			ID:        uuid.New().String(),
			Status:    StatusPending,
			Priority:  PriorityNormal,
			Channel:   ChannelInApp,
			Metadata:  make(map[string]interface{}),
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}
}

func (b *NotificationBuilder) WithUserID(userID string) *NotificationBuilder {
	b.notification.UserID = userID
	return b
}

func (b *NotificationBuilder) WithType(t string) *NotificationBuilder {
	b.notification.Type = t
	return b
}

func (b *NotificationBuilder) WithTitle(title string) *NotificationBuilder {
	b.notification.Title = title
	return b
}

func (b *NotificationBuilder) WithBody(body string) *NotificationBuilder {
	b.notification.Body = body
	return b
}

func (b *NotificationBuilder) WithChannel(channel Channel) *NotificationBuilder {
	b.notification.Channel = channel
	return b
}

func (b *NotificationBuilder) WithPriority(priority Priority) *NotificationBuilder {
	b.notification.Priority = priority
	return b
}

func (b *NotificationBuilder) WithSourceEvent(sourceEvent string) *NotificationBuilder {
	b.notification.SourceEvent = sourceEvent
	return b
}

func (b *NotificationBuilder) WithSourceID(sourceID string) *NotificationBuilder {
	b.notification.SourceID = sourceID
	return b
}

func (b *NotificationBuilder) WithMetadata(key string, value interface{}) *NotificationBuilder {
	b.notification.Metadata[key] = value
	return b
}

func (b *NotificationBuilder) Build() *Notification {
	return b.notification
}
