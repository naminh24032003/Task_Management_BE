package delivery

import (
	"context"
	"fmt"
	"sync"

	"notification-service/internal/domain/notification"
	"notification-service/internal/ports"
)

// MultiChannelSenderImpl implements MultiChannelSender
type MultiChannelSenderImpl struct {
	senders map[notification.Channel]ports.NotificationSender
	mu      sync.RWMutex
}

// NewMultiChannelSender creates a new MultiChannelSender
func NewMultiChannelSender() *MultiChannelSenderImpl {
	return &MultiChannelSenderImpl{
		senders: make(map[notification.Channel]ports.NotificationSender),
	}
}

// RegisterSender registers a sender for a specific channel
func (m *MultiChannelSenderImpl) RegisterSender(sender ports.NotificationSender) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.senders[sender.Channel()] = sender
}

// GetSender returns the sender for a specific channel
func (m *MultiChannelSenderImpl) GetSender(channel notification.Channel) (ports.NotificationSender, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	sender, ok := m.senders[channel]
	return sender, ok
}

// SendToChannels sends a notification through specified channels
func (m *MultiChannelSenderImpl) SendToChannels(ctx context.Context, n *notification.Notification, channels []notification.Channel) []ports.SendResult {
	results := make([]ports.SendResult, 0, len(channels))

	for _, channel := range channels {
		result := ports.SendResult{
			Channel: channel,
		}

		sender, ok := m.GetSender(channel)
		if !ok {
			result.Success = false
			result.Error = fmt.Errorf("no sender registered for channel: %s", channel)
			results = append(results, result)
			continue
		}

		if !sender.IsAvailable() {
			result.Success = false
			result.Error = fmt.Errorf("sender not available for channel: %s", channel)
			results = append(results, result)
			continue
		}

		// Create a copy of the notification for this channel
		channelNotification := *n
		channelNotification.Channel = channel

		if err := sender.Send(ctx, &channelNotification); err != nil {
			result.Success = false
			result.Error = err
		} else {
			result.Success = true
		}

		results = append(results, result)
	}

	return results
}

// Send sends a notification through its configured channel
func (m *MultiChannelSenderImpl) Send(ctx context.Context, n *notification.Notification) error {
	sender, ok := m.GetSender(n.Channel)
	if !ok {
		return fmt.Errorf("no sender registered for channel: %s", n.Channel)
	}

	if !sender.IsAvailable() {
		return fmt.Errorf("sender not available for channel: %s", n.Channel)
	}

	return sender.Send(ctx, n)
}
