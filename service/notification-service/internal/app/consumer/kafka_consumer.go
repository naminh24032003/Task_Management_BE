package consumer

import (
	"context"
	"log"

	"notification-service/internal/app/dispatcher"
	"notification-service/internal/infrastructure/kafka"
	"notification-service/internal/ports"
)

// KafkaConsumerBootstrap handles Kafka consumer setup and lifecycle
type KafkaConsumerBootstrap struct {
	consumer   *kafka.Consumer
	dispatcher *dispatcher.Dispatcher
}

// NewKafkaConsumerBootstrap creates a new KafkaConsumerBootstrap
func NewKafkaConsumerBootstrap(
	consumer *kafka.Consumer,
	dispatcher *dispatcher.Dispatcher,
) *KafkaConsumerBootstrap {
	return &KafkaConsumerBootstrap{
		consumer:   consumer,
		dispatcher: dispatcher,
	}
}

// Start starts the Kafka consumer
func (b *KafkaConsumerBootstrap) Start(ctx context.Context) error {
	// Register dispatcher as message handler
	b.consumer.RegisterHandler(ports.MessageHandlerFunc(b.dispatcher.Handle))

	log.Println("Starting Kafka consumer...")
	return b.consumer.Start(ctx)
}

// Stop stops the Kafka consumer
func (b *KafkaConsumerBootstrap) Stop() error {
	log.Println("Stopping Kafka consumer...")
	return b.consumer.Stop()
}
