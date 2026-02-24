package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/scram"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"notification-service/internal/infrastructure/resilience"
	"notification-service/internal/ports"
)

const (
	defaultWorkerPoolSize = 5
	defaultBufferSize     = 100
)

// ConsumerConfig contains configuration for Kafka consumer
type ConsumerConfig struct {
	Brokers        []string
	Topic          string
	GroupID        string
	SASL           *SASLConfig
	WorkerPoolSize int
	BufferSize     int
}

// Consumer is a Kafka message consumer with worker pool for high concurrency
type Consumer struct {
	reader  *kafka.Reader
	config  ConsumerConfig
	handler ports.MessageHandler
	tracer  trace.Tracer

	msgChan chan kafka.Message
	done    chan struct{}
	wg      sync.WaitGroup

	// resilience: circuit breaker on message handling
	handlerCB *resilience.CircuitBreaker

	// metrics
	processed atomic.Int64
	errors    atomic.Int64
	retries   atomic.Int64
}

// NewConsumer creates a new Kafka consumer with worker pool support
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
		MaxWait:        3 * time.Second,
	})

	// Apply defaults
	if config.WorkerPoolSize <= 0 {
		config.WorkerPoolSize = defaultWorkerPoolSize
	}
	if config.BufferSize <= 0 {
		config.BufferSize = defaultBufferSize
	}

	return &Consumer{
		reader:  reader,
		config:  config,
		tracer:  otel.Tracer("notification-service/kafka-consumer"),
		msgChan: make(chan kafka.Message, config.BufferSize),
		done:    make(chan struct{}),
		handlerCB: resilience.NewCircuitBreaker("kafka-handler",
			resilience.WithFailureThreshold(10),         // tolerate more errors — Kafka is high-volume
			resilience.WithResetTimeout(60*time.Second), // longer cooldown
		),
	}, nil
}

// RegisterHandler registers a message handler
func (c *Consumer) RegisterHandler(handler ports.MessageHandler) {
	c.handler = handler
}

// Start starts consuming messages with a worker pool
func (c *Consumer) Start(ctx context.Context) error {
	log.Printf("Starting Kafka consumer for topic: %s, group: %s (workers: %d, buffer: %d)",
		c.config.Topic, c.config.GroupID, c.config.WorkerPoolSize, c.config.BufferSize)

	// Launch worker pool
	for i := 0; i < c.config.WorkerPoolSize; i++ {
		c.wg.Add(1)
		go c.worker(ctx, i)
	}

	// Start metrics reporter
	go c.reportMetrics(ctx)

	// Producer goroutine: fetch from Kafka and push to buffered channel
	defer func() {
		close(c.msgChan) // Signal workers to drain and exit
		c.wg.Wait()      // Wait for all workers to finish
		log.Printf("All workers stopped. Total processed: %d, errors: %d",
			c.processed.Load(), c.errors.Load())
	}()

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

			// Push to buffered channel — blocks if buffer is full (backpressure)
			select {
			case c.msgChan <- msg:
			case <-ctx.Done():
				return ctx.Err()
			case <-c.done:
				return nil
			}
		}
	}
}

// worker is a goroutine that processes messages from the buffered channel
func (c *Consumer) worker(ctx context.Context, id int) {
	defer c.wg.Done()
	log.Printf("Worker %d started", id)

	const maxRetries = 3

	for msg := range c.msgChan {
		var finalErr error

		// Retry with exponential backoff + circuit breaker
		err := c.handlerCB.Exec(func() error {
			for attempt := 0; attempt <= maxRetries; attempt++ {
				processErr := c.processMessage(ctx, msg)
				if processErr == nil {
					return nil
				}
				finalErr = processErr
				if attempt >= maxRetries {
					break
				}
				c.retries.Add(1)
				// Exponential backoff: 500ms, 1s, 2s + jitter
				base := float64(500*time.Millisecond) * math.Pow(2, float64(attempt))
				jitter := base * 0.3 * (rand.Float64()*2 - 1)
				delay := time.Duration(math.Max(0, base+jitter))
				log.Printf("Worker %d: retry %d/%d for partition=%d offset=%d (waiting %v): %v",
					id, attempt+1, maxRetries, msg.Partition, msg.Offset, delay, processErr)

				select {
				case <-time.After(delay):
				case <-ctx.Done():
					return ctx.Err()
				}
			}
			return finalErr
		})

		if err != nil {
			c.errors.Add(1)
			if err == resilience.ErrCircuitOpen {
				log.Printf("Worker %d: circuit OPEN, skipping message (partition=%d, offset=%d)",
					id, msg.Partition, msg.Offset)
			} else {
				log.Printf("Worker %d: error processing message after retries (partition=%d, offset=%d): %v",
					id, msg.Partition, msg.Offset, err)
			}
		} else {
			c.processed.Add(1)
		}

		// Commit after processing (regardless of success/failure to avoid reprocessing poison messages)
		// Idempotency store handles deduplication on retry
		if err := c.reader.CommitMessages(ctx, msg); err != nil {
			log.Printf("Worker %d: error committing message: %v", id, err)
		}
	}

	log.Printf("Worker %d stopped", id)
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

// reportMetrics logs throughput metrics periodically
func (c *Consumer) reportMetrics(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.done:
			return
		case <-ticker.C:
			log.Printf("Consumer metrics — processed: %d, errors: %d, retries: %d, circuit: %s, buffer: %d/%d",
				c.processed.Load(), c.errors.Load(), c.retries.Load(),
				c.handlerCB.State(), len(c.msgChan), cap(c.msgChan))
		}
	}
}

// Stop gracefully stops the consumer
func (c *Consumer) Stop() error {
	close(c.done)
	// msgChan will be closed in Start() defer, which triggers workers to drain
	return c.reader.Close()
}
