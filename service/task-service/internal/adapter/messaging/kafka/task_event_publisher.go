package kafka

import (
	"context"
	"fmt"
	"task-service/internal/application/port"
	"task-service/internal/domain/event"
)

// TaskEventPublisher implements port.EventPublisher for Kafka
type TaskEventPublisher struct {
	producer *Producer
}

// NewTaskEventPublisher creates a new Kafka task event publisher
func NewTaskEventPublisher(producer *Producer) port.EventPublisher {
	return &TaskEventPublisher{
		producer: producer,
	}
}

// Publish publishes domain events to Kafka
func (p *TaskEventPublisher) Publish(ctx context.Context, events []interface{}) error {
	for _, evt := range events {
		key := extractEventKey(evt)

		if err := p.producer.PublishEvent(ctx, key, evt); err != nil {
			return fmt.Errorf("failed to publish event to kafka: %w", err)
		}
	}
	return nil
}

// extractEventKey returns the aggregate ID as partition key for ordering guarantees
func extractEventKey(evt interface{}) string {
	if de, ok := evt.(event.DomainEvent); ok {
		return de.AggregateID()
	}
	return ""
}
