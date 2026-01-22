package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/scram"
)

// ProducerConfig holds configuration for Kafka producer
type ProducerConfig struct {
	Brokers  []string
	Topic    string
	SASL     *SASLConfig
}

// SASLConfig holds SASL authentication configuration
type SASLConfig struct {
	Enabled   bool
	Mechanism string
	Username  string
	Password  string
}

// Producer publishes messages to Kafka
type Producer struct {
	writer *kafka.Writer
	config ProducerConfig
}

// NewProducer creates a new Kafka producer with SASL support
func NewProducer(config ProducerConfig) (*Producer, error) {
	transport := &kafka.Transport{
		DialTimeout: 10 * time.Second,
	}

	// Configure SASL if enabled
	if config.SASL != nil && config.SASL.Enabled {
		mechanism, err := scram.Mechanism(scram.SHA256, config.SASL.Username, config.SASL.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to create SASL mechanism: %w", err)
		}
		transport.SASL = mechanism
	}

	writer := &kafka.Writer{
		Addr:         kafka.TCP(config.Brokers...),
		Topic:        config.Topic,
		Balancer:     &kafka.LeastBytes{},
		Transport:    transport,
		BatchTimeout: 10 * time.Millisecond,
		Async:        false,
	}

	return &Producer{
		writer: writer,
		config: config,
	}, nil
}

// PublishEvent publishes a single event to Kafka
func (p *Producer) PublishEvent(ctx context.Context, key string, event interface{}) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	msg := kafka.Message{
		Key:   []byte(key),
		Value: data,
		Time:  time.Now(),
	}

	if err := p.writer.WriteMessages(ctx, msg); err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	return nil
}

// Publish publishes multiple events to Kafka
func (p *Producer) Publish(ctx context.Context, events []interface{}) error {
	messages := make([]kafka.Message, 0, len(events))

	for _, event := range events {
		data, err := json.Marshal(event)
		if err != nil {
			return fmt.Errorf("failed to marshal event: %w", err)
		}

		messages = append(messages, kafka.Message{
			Value: data,
			Time:  time.Now(),
		})
	}

	return p.writer.WriteMessages(ctx, messages...)
}

// PublishWithKey publishes events with keys for partitioning
func (p *Producer) PublishWithKey(ctx context.Context, key string, events []interface{}) error {
	messages := make([]kafka.Message, 0, len(events))

	for _, event := range events {
		data, err := json.Marshal(event)
		if err != nil {
			return fmt.Errorf("failed to marshal event: %w", err)
		}

		messages = append(messages, kafka.Message{
			Key:   []byte(key),
			Value: data,
			Time:  time.Now(),
		})
	}

	return p.writer.WriteMessages(ctx, messages...)
}

// Close closes the producer
func (p *Producer) Close() error {
	return p.writer.Close()
}
