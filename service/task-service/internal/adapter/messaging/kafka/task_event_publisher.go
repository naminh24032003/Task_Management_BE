package kafka

import (
	"context"
	"fmt"
	"task-service/internal/application/handler"
)

// TaskEventPublisher implements handler.EventPublisher for Kafka
type TaskEventPublisher struct {
	producer *Producer
}

// NewTaskEventPublisher creates a new Kafka task event publisher
func NewTaskEventPublisher(producer *Producer) handler.EventPublisher {
	return &TaskEventPublisher{
		producer: producer,
	}
}

// Publish publishes domain events to Kafka
func (p *TaskEventPublisher) Publish(ctx context.Context, events []interface{}) error {
	for _, evt := range events {
		// In a real app, you might want to switch based on event type
		// to determine the key or topic
		key := "" // Could be task ID

		if err := p.producer.PublishEvent(ctx, key, evt); err != nil {
			return fmt.Errorf("failed to publish event to kafka: %w", err)
		}
	}
	return nil
}
