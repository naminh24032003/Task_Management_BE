package ports

import "context"

// EventConsumer defines the interface for consuming events from message broker
type EventConsumer interface {
	// Start starts consuming events
	Start(ctx context.Context) error

	// Stop stops consuming events
	Stop() error

	// RegisterHandler registers a handler for processing messages
	RegisterHandler(handler MessageHandler)
}

// MessageHandler defines the interface for handling consumed messages
type MessageHandler interface {
	Handle(ctx context.Context, message map[string]interface{}) error
}

// MessageHandlerFunc is a function type that implements MessageHandler
type MessageHandlerFunc func(ctx context.Context, message map[string]interface{}) error

func (f MessageHandlerFunc) Handle(ctx context.Context, message map[string]interface{}) error {
	return f(ctx, message)
}
