package delivery

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"notification-service/internal/domain/notification"
)

// PushConfig contains push notification configuration
type PushConfig struct {
	FCMServerKey string
	FCMEndpoint  string
	Enabled      bool
}

// PushSender sends push notifications via FCM
type PushSender struct {
	config     PushConfig
	httpClient *http.Client
	available  bool
}

// NewPushSender creates a new PushSender
func NewPushSender(config PushConfig) *PushSender {
	return &PushSender{
		config: config,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		available: config.Enabled && config.FCMServerKey != "",
	}
}

// FCMMessage represents a Firebase Cloud Messaging message
type FCMMessage struct {
	To           string                 `json:"to,omitempty"`
	Notification FCMNotification        `json:"notification"`
	Data         map[string]interface{} `json:"data,omitempty"`
	Priority     string                 `json:"priority,omitempty"`
}

// FCMNotification represents the notification payload
type FCMNotification struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Icon  string `json:"icon,omitempty"`
	Badge string `json:"badge,omitempty"`
	Sound string `json:"sound,omitempty"`
}

// Send sends a push notification
func (s *PushSender) Send(ctx context.Context, n *notification.Notification) error {
	if !s.available {
		log.Printf("Push sender not available, skipping notification %s", n.ID)
		return nil
	}

	// Get push token from metadata
	pushToken, ok := n.Metadata["push_token"].(string)
	if !ok || pushToken == "" {
		log.Printf("No push token in notification metadata, skipping: %s", n.ID)
		return nil
	}

	// Map priority
	priority := "normal"
	if n.Priority == notification.PriorityHigh || n.Priority == notification.PriorityUrgent {
		priority = "high"
	}

	// Build FCM message
	fcmMessage := FCMMessage{
		To: pushToken,
		Notification: FCMNotification{
			Title: n.Title,
			Body:  n.Body,
			Sound: "default",
		},
		Data: map[string]interface{}{
			"notification_id": n.ID,
			"type":            n.Type,
			"source_event":    n.SourceEvent,
			"source_id":       n.SourceID,
		},
		Priority: priority,
	}

	// Add metadata to data payload
	for k, v := range n.Metadata {
		if k != "push_token" && k != "email" {
			fcmMessage.Data[k] = v
		}
	}

	// Send to FCM
	if err := s.sendToFCM(ctx, fcmMessage); err != nil {
		return fmt.Errorf("failed to send push notification: %w", err)
	}

	log.Printf("Push notification sent: %s to token %s...", n.ID, pushToken[:min(10, len(pushToken))])
	return nil
}

func (s *PushSender) sendToFCM(ctx context.Context, message FCMMessage) error {
	endpoint := s.config.FCMEndpoint
	if endpoint == "" {
		endpoint = "https://fcm.googleapis.com/fcm/send"
	}

	body, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal FCM message: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "key="+s.config.FCMServerKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("FCM returned status: %d", resp.StatusCode)
	}

	return nil
}

// Channel returns the channel this sender handles
func (s *PushSender) Channel() notification.Channel {
	return notification.ChannelPush
}

// IsAvailable checks if the sender is available
func (s *PushSender) IsAvailable() bool {
	return s.available
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
