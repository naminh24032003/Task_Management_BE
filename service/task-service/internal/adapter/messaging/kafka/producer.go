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

// ProducerConfig holds configuration for Kafka producer
type ProducerConfig struct {
	Brokers []string
	Topic   string
	SASL    *SASLConfig
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

// PublishEvent publishes a single event to Kafka with tracing
func (p *Producer) PublishEvent(ctx context.Context, key string, event interface{}) error {
	tracer := otel.Tracer("kafka")
	ctx, span := tracer.Start(ctx, fmt.Sprintf("kafka.publish %s", p.config.Topic),
		trace.WithSpanKind(trace.SpanKindProducer),
		trace.WithAttributes(
			attribute.String("messaging.system", "kafka"),
			attribute.String("messaging.destination", p.config.Topic),
			attribute.String("messaging.kafka.message_key", key),
		),
	)
	defer span.End()

	data, err := json.Marshal(event)
	if err != nil {
		span.RecordError(err)
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	headers := []kafka.Header{}
	otel.GetTextMapPropagator().Inject(ctx, &kafkaHeaderCarrier{headers: &headers})

	msg := kafka.Message{
		Key:     []byte(key),
		Value:   data,
		Headers: headers,
		Time:    time.Now(),
	}

	if err := p.writer.WriteMessages(ctx, msg); err != nil {
		span.RecordError(err)
		return fmt.Errorf("failed to write message: %w", err)
	}

	return nil
}

type kafkaHeaderCarrier struct {
	headers *[]kafka.Header
}

func (c *kafkaHeaderCarrier) Get(key string) string {
	for _, h := range *c.headers {
		if h.Key == key {
			return string(h.Value)
		}
	}
	return ""
}

func (c *kafkaHeaderCarrier) Set(key string, value string) {
	*c.headers = append(*c.headers, kafka.Header{
		Key:   key,
		Value: []byte(value),
	})
}

func (c *kafkaHeaderCarrier) Keys() []string {
	keys := make([]string, len(*c.headers))
	for i, h := range *c.headers {
		keys[i] = h.Key
	}
	return keys
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
