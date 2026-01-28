package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/scram"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"notification-service/internal/ports"
)

// ConsumerConfig contains configuration for Kafka consumer
type ConsumerConfig struct {
	Brokers  []string
	Topic    string
	GroupID  string
	SASL     *SASLConfig
}

// Consumer is a Kafka message consumer
type Consumer struct {
	reader  *kafka.Reader
	config  ConsumerConfig
	handler ports.MessageHandler
	tracer  trace.Tracer
	done    chan struct{}
}

// NewConsumer creates a new Kafka consumer
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
		MinBytes:       10e3,              // 10KB
		MaxBytes:       10e6,              // 10MB
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
		MaxWait:        3 * time.Second,
	})

	return &Consumer{
		reader: reader,
		config: config,
		tracer: otel.Tracer("notification-service/kafka-consumer"),
		done:   make(chan struct{}),
	}, nil
}

// RegisterHandler registers a message handler
func (c *Consumer) RegisterHandler(handler ports.MessageHandler) {
	c.handler = handler
}

// Start starts consuming messages
func (c *Consumer) Start(ctx context.Context) error {
	log.Printf("Starting Kafka consumer for topic: %s, group: %s", c.config.Topic, c.config.GroupID)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-c.done:
			return nil
		default:
			msg, err := c.reader.FetchMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return ctx.Err()
				}
				log.Printf("Error fetching message: %v", err)
				continue
			}

			if err := c.processMessage(ctx, msg); err != nil {
				log.Printf("Error processing message: %v", err)
				// Continue processing other messages even if one fails
			}

			// Commit the message
			if err := c.reader.CommitMessages(ctx, msg); err != nil {
				log.Printf("Error committing message: %v", err)
			}
		}
	}
}

func (c *Consumer) processMessage(ctx context.Context, msg kafka.Message) error {
	// Extract trace context from headers
	headers := make(kafkaHeaderCarrier, len(msg.Headers))
	copy(headers, msg.Headers)
	ctx = otel.GetTextMapPropagator().Extract(ctx, &headers)

	ctx, span := c.tracer.Start(ctx, "kafka.consume",
		trace.WithAttributes(
			attribute.String("messaging.system", "kafka"),
			attribute.String("messaging.destination", c.config.Topic),
			attribute.String("messaging.kafka.consumer_group", c.config.GroupID),
			attribute.Int64("messaging.kafka.partition", int64(msg.Partition)),
			attribute.Int64("messaging.kafka.offset", msg.Offset),
		),
	)
	defer span.End()

	// Parse message
	var data map[string]interface{}
	if err := json.Unmarshal(msg.Value, &data); err != nil {
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}

	// Add message metadata
	data["_kafka_partition"] = msg.Partition
	data["_kafka_offset"] = msg.Offset
	data["_kafka_key"] = string(msg.Key)
	data["_kafka_timestamp"] = msg.Time

	// Handle message
	if c.handler != nil {
		if err := c.handler.Handle(ctx, data); err != nil {
			return fmt.Errorf("handler error: %w", err)
		}
	}

	return nil
}

// Stop stops the consumer
func (c *Consumer) Stop() error {
	close(c.done)
	return c.reader.Close()
}
