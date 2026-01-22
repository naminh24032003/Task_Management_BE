package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/scram"
)

// ConsumerConfig holds configuration for Kafka consumer
type ConsumerConfig struct {
	Brokers  []string
	Topic    string
	GroupID  string
	SASL     *SASLConfig
}

// Consumer consumes messages from Kafka
type Consumer struct {
	reader *kafka.Reader
	config ConsumerConfig
}

// NewConsumer creates a new Kafka consumer with SASL support
func NewConsumer(config ConsumerConfig) (*Consumer, error) {
	dialer := &kafka.Dialer{
		Timeout:   10 * time.Second,
		DualStack: true,
	}

	// Configure SASL if enabled
	if config.SASL != nil && config.SASL.Enabled {
		mechanism, err := scram.Mechanism(scram.SHA256, config.SASL.Username, config.SASL.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to create SASL mechanism: %w", err)
		}
		dialer.SASLMechanism = mechanism
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        config.Brokers,
		Topic:          config.Topic,
		GroupID:        config.GroupID,
		Dialer:         dialer,
		MinBytes:       10e3, // 10KB
		MaxBytes:       10e6, // 10MB
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})

	return &Consumer{
		reader: reader,
		config: config,
	}, nil
}

// Start starts consuming messages
func (c *Consumer) Start(ctx context.Context, handler MessageHandler) error {
	log.Printf("Starting Kafka consumer for topic: %s, group: %s", c.config.Topic, c.config.GroupID)

	for {
		msg, err := c.reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				log.Println("Consumer context cancelled, stopping...")
				return nil
			}
			log.Printf("Error reading message: %v", err)
			continue
		}

		var event map[string]interface{}
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		log.Printf("Received message from topic %s, partition %d, offset %d",
			msg.Topic, msg.Partition, msg.Offset)

		if err := handler.Handle(ctx, event); err != nil {
			log.Printf("Error handling message: %v", err)
		}
	}
}

// FetchMessage fetches a single message without auto-commit
func (c *Consumer) FetchMessage(ctx context.Context) (kafka.Message, error) {
	return c.reader.FetchMessage(ctx)
}

// CommitMessages commits the given messages
func (c *Consumer) CommitMessages(ctx context.Context, msgs ...kafka.Message) error {
	return c.reader.CommitMessages(ctx, msgs...)
}

// Close closes the consumer
func (c *Consumer) Close() error {
	log.Println("Closing Kafka consumer...")
	return c.reader.Close()
}

// MessageHandler handles consumed messages
type MessageHandler interface {
	Handle(ctx context.Context, message map[string]interface{}) error
}

// MessageHandlerFunc is a function adapter for MessageHandler
type MessageHandlerFunc func(ctx context.Context, message map[string]interface{}) error

// Handle implements MessageHandler
func (f MessageHandlerFunc) Handle(ctx context.Context, message map[string]interface{}) error {
	return f(ctx, message)
}
