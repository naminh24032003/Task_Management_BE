package kafka

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/segmentio/kafka-go"
)

// Producer publishes messages to Kafka
type Producer struct {
	writer *kafka.Writer
}

// NewProducer creates a new Kafka producer
func NewProducer(brokers []string, topic string) *Producer {
	writer := &kafka.Writer{
		Addr:     kafka.TCP(brokers...),
		Topic:    topic,
		Balancer: &kafka.LeastBytes{},
	}

	return &Producer{writer: writer}
}

// Publish publishes events to Kafka
func (p *Producer) Publish(ctx context.Context, events []interface{}) error {
	messages := make([]kafka.Message, 0, len(events))

	for _, event := range events {
		data, err := json.Marshal(event)
		if err != nil {
			return fmt.Errorf("failed to marshal event: %w", err)
		}

		messages = append(messages, kafka.Message{
			Value: data,
		})
	}

	return p.writer.WriteMessages(ctx, messages...)
}

// Close closes the producer
func (p *Producer) Close() error {
	return p.writer.Close()
}
