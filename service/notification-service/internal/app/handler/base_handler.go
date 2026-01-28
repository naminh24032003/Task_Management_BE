package handler

import (
	"notification-service/internal/infrastructure/delivery"
	"notification-service/internal/ports"
)

// EventHandler defines the interface for event handlers
type EventHandler interface {
	EventType() string
	Handle(ctx interface{}, data map[string]interface{}) error
}

// BaseHandler contains common dependencies for all handlers
type BaseHandler struct {
	repo        ports.NotificationRepository
	multiSender *delivery.MultiChannelSenderImpl
	idempotency ports.IdempotencyStore
}

// NewBaseHandler creates a new BaseHandler
func NewBaseHandler(
	repo ports.NotificationRepository,
	multiSender *delivery.MultiChannelSenderImpl,
	idempotency ports.IdempotencyStore,
) *BaseHandler {
	return &BaseHandler{
		repo:        repo,
		multiSender: multiSender,
		idempotency: idempotency,
	}
}

// Helper functions
func getStringValue(data map[string]interface{}, key, defaultValue string) string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultValue
}

func getStringSlice(data map[string]interface{}, key string) []string {
	if val, ok := data[key]; ok {
		if slice, ok := val.([]interface{}); ok {
			result := make([]string, 0, len(slice))
			for _, item := range slice {
				if str, ok := item.(string); ok {
					result = append(result, str)
				}
			}
			return result
		}
		if slice, ok := val.([]string); ok {
			return slice
		}
	}
	return []string{}
}
