package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"notification-service/internal/domain/notification"
)

const (
	// RealtimeChannel is the Redis Pub/Sub channel for real-time notification delivery
	RealtimeChannel = "notification:realtime"
)

// RealtimeEvent represents the event published to Redis Pub/Sub for BFF consumption
type RealtimeEvent struct {
	EventType      string                 `json:"event_type"`
	NotificationID string                 `json:"notification_id"`
	UserID         string                 `json:"user_id"`
	Type           string                 `json:"type"`
	Title          string                 `json:"title"`
	Body           string                 `json:"body"`
	Priority       string                 `json:"priority"`
	SourceEvent    string                 `json:"source_event"`
	SourceID       string                 `json:"source_id"`
	Metadata       map[string]interface{} `json:"metadata"`
	CreatedAt      string                 `json:"created_at"`
}

// RedisPubSubPublisher publishes notifications via Redis Pub/Sub for real-time delivery
type RedisPubSubPublisher struct {
	client *goredis.ClusterClient
}

// NewRedisPubSubPublisher creates a new RedisPubSubPublisher
func NewRedisPubSubPublisher(client *goredis.ClusterClient) *RedisPubSubPublisher {
	return &RedisPubSubPublisher{client: client}
}

// PublishNotification publishes a notification to the Redis Pub/Sub real-time channel
func (p *RedisPubSubPublisher) PublishNotification(ctx context.Context, n *notification.Notification) error {
	event := RealtimeEvent{
		EventType:      "notification.created",
		NotificationID: n.ID,
		UserID:         n.UserID,
		Type:           n.Type,
		Title:          n.Title,
		Body:           n.Body,
		Priority:       string(n.Priority),
		SourceEvent:    n.SourceEvent,
		SourceID:       n.SourceID,
		Metadata:       n.Metadata,
		CreatedAt:      n.CreatedAt.Format(time.RFC3339),
	}

	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal notification event: %w", err)
	}

	if err := p.client.Publish(ctx, RealtimeChannel, string(data)).Err(); err != nil {
		return fmt.Errorf("failed to publish to Redis Pub/Sub: %w", err)
	}

	log.Printf("Published notification %s to Redis Pub/Sub for user %s", n.ID, n.UserID)
	return nil
}
