package dispatcher

import (
	"context"
	"fmt"
	"log"
	"time"

	"notification-service/internal/ports"
)

// EventHandler interface for handlers
type EventHandler interface {
	EventType() string
	Handle(ctx context.Context, data map[string]interface{}) error
}

// Dispatcher routes events to appropriate handlers
type Dispatcher struct {
	handlers    map[string]EventHandler
	idempotency ports.IdempotencyStore
}

// NewDispatcher creates a new Dispatcher
func NewDispatcher(idempotency ports.IdempotencyStore) *Dispatcher {
	return &Dispatcher{
		handlers:    make(map[string]EventHandler),
		idempotency: idempotency,
	}
}

// RegisterHandler registers a handler for an event type
func (d *Dispatcher) RegisterHandler(handler EventHandler) {
	eventType := handler.EventType()
	d.handlers[eventType] = handler
	log.Printf("Registered handler for event type: %s", eventType)
}

// Dispatch routes an event to the appropriate handler
func (d *Dispatcher) Dispatch(ctx context.Context, data map[string]interface{}) error {
	eventType, ok := data["event_type"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid event_type in message")
	}

	// Generate idempotency key
	idempotencyKey := generateIdempotencyKey(data)

	// Check idempotency
	if d.idempotency != nil {
		alreadyProcessed, err := d.idempotency.CheckAndMark(ctx, idempotencyKey, 24*time.Hour)
		if err != nil {
			log.Printf("Warning: idempotency check failed: %v", err)
			// Continue processing even if idempotency check fails
		} else if alreadyProcessed {
			log.Printf("Event already processed, skipping: %s", idempotencyKey)
			return nil
		}
	}

	handler, ok := d.handlers[eventType]
	if !ok {
		log.Printf("No handler registered for event type: %s", eventType)
		return nil
	}

	log.Printf("Dispatching event: %s", eventType)

	if err := handler.Handle(ctx, data); err != nil {
		// Remove idempotency mark on failure so event can be retried
		if d.idempotency != nil {
			d.idempotency.Remove(ctx, idempotencyKey)
		}
		return fmt.Errorf("handler error for %s: %w", eventType, err)
	}

	return nil
}

// Handle implements ports.MessageHandler
func (d *Dispatcher) Handle(ctx context.Context, data map[string]interface{}) error {
	return d.Dispatch(ctx, data)
}

// generateIdempotencyKey generates a unique key for idempotency checking
func generateIdempotencyKey(data map[string]interface{}) string {
	eventType := getStringValue(data, "event_type", "unknown")
	aggregateID := getStringValue(data, "aggregate_id", "")
	occurredAt := getStringValue(data, "occurred_at", "")

	// Use Kafka offset if available for uniqueness
	kafkaKey := getStringValue(data, "_kafka_key", "")
	kafkaOffset := data["_kafka_offset"]

	if kafkaOffset != nil {
		return fmt.Sprintf("%s:%s:%v", eventType, kafkaKey, kafkaOffset)
	}

	return fmt.Sprintf("%s:%s:%s", eventType, aggregateID, occurredAt)
}

func getStringValue(data map[string]interface{}, key, defaultValue string) string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultValue
}
