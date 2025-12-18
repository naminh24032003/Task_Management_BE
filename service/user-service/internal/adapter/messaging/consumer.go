package messaging

import (
	"context"
	"encoding/json"
	"log"

	"github.com/segmentio/kafka-go"
)

// Consumer consumes messages from Kafka
type Consumer struct {
	reader *kafka.Reader
}

// NewConsumer creates a new Kafka consumer
func NewConsumer(brokers []string, topic, groupID string) *Consumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: brokers,
		Topic:   topic,
		GroupID: groupID,
	})

	return &Consumer{reader: reader}
}

// Start starts consuming messages
func (c *Consumer) Start(ctx context.Context, handler MessageHandler) error {
	for {
		msg, err := c.reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil // Context cancelled
			}
			log.Printf("error reading message: %v", err)
			continue
		}

		var event map[string]interface{}
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("error unmarshaling message: %v", err)
			continue
		}

		if err := handler.Handle(ctx, event); err != nil {
			log.Printf("error handling message: %v", err)
		}
	}
}

// Close closes the consumer
func (c *Consumer) Close() error {
	return c.reader.Close()
}

// MessageHandler handles consumed messages
type MessageHandler interface {
	Handle(ctx context.Context, message map[string]interface{}) error
}
