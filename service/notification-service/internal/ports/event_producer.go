package ports

import "context"

// EventProducer defines the interface for publishing events to message broker
type EventProducer interface {
	// Publish publishes events to the message broker
	Publish(ctx context.Context, events []interface{}) error

	// PublishEvent publishes a single event with a partition key
	PublishEvent(ctx context.Context, key string, event interface{}) error

	// Close closes the producer connection
	Close() error
}
