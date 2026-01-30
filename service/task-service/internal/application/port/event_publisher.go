package port

import "context"

// EventPublisher interface for publishing domain events to message brokers
// This is an output port - implementations are in the adapter layer (Kafka, RabbitMQ, etc.)
type EventPublisher interface {
	Publish(ctx context.Context, events []interface{}) error
}
