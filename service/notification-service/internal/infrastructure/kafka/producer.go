package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/scram"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// ProducerConfig contains configuration for Kafka producer
type ProducerConfig struct {
	Brokers []string
	Topic   string
	SASL    *SASLConfig
}

// SASLConfig contains SASL authentication configuration
type SASLConfig struct {
	Enabled   bool
	Mechanism string
	Username  string
	Password  string
}

// Producer is a Kafka message producer
type Producer struct {
	writer *kafka.Writer
	config ProducerConfig
	tracer trace.Tracer
}

// NewProducer creates a new Kafka producer
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
		tracer: otel.Tracer("notification-service/kafka-producer"),
	}, nil
}

// kafkaHeaderCarrier implements propagation.TextMapCarrier for Kafka headers
type kafkaHeaderCarrier []kafka.Header

func (c *kafkaHeaderCarrier) Get(key string) string {
	for _, h := range *c {
		if h.Key == key {
			return string(h.Value)
		}
	}
	return ""
}

func (c *kafkaHeaderCarrier) Set(key, val string) {
	for i, h := range *c {
		if h.Key == key {
			(*c)[i].Value = []byte(val)
			return
		}
	}
	*c = append(*c, kafka.Header{Key: key, Value: []byte(val)})
}

func (c *kafkaHeaderCarrier) Keys() []string {
	keys := make([]string, len(*c))
	for i, h := range *c {
		keys[i] = h.Key
	}
	return keys
}

// PublishEvent publishes a single event with a partition key
func (p *Producer) PublishEvent(ctx context.Context, key string, event interface{}) error {
	ctx, span := p.tracer.Start(ctx, "kafka.produce",
		trace.WithAttributes(
			attribute.String("messaging.system", "kafka"),
			attribute.String("messaging.destination", p.config.Topic),
			attribute.String("messaging.kafka.message_key", key),
		),
	)
	defer span.End()

	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	headers := make(kafkaHeaderCarrier, 0)
	otel.GetTextMapPropagator().Inject(ctx, &headers)

	msg := kafka.Message{
		Key:     []byte(key),
		Value:   data,
		Headers: headers,
	}

	if err := p.writer.WriteMessages(ctx, msg); err != nil {
		return fmt.Errorf("failed to write message to kafka: %w", err)
	}

	return nil
}

// Publish publishes multiple events
func (p *Producer) Publish(ctx context.Context, events []interface{}) error {
	for _, evt := range events {
		if err := p.PublishEvent(ctx, "", evt); err != nil {
			return err
		}
	}
	return nil
}

// Close closes the producer
func (p *Producer) Close() error {
	return p.writer.Close()
}
