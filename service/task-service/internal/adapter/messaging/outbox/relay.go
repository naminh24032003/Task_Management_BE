package outbox

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"task-service/internal/domain/entity"
	"task-service/internal/domain/repository"
)

// MessagePublisher interface for publishing messages to a message broker
type MessagePublisher interface {
	PublishEvent(ctx context.Context, key string, event interface{}) error
}

// RelayConfig holds configuration for the outbox relay
type RelayConfig struct {
	// PollInterval is how often to check for pending messages
	PollInterval time.Duration
	// BatchSize is maximum number of messages to process per batch
	BatchSize int
	// Workers is number of concurrent workers
	Workers int
	// RetentionHours is how long to keep published messages
	RetentionHours int
	// CleanupInterval is how often to run cleanup
	CleanupInterval time.Duration
}

// DefaultRelayConfig returns default configuration
func DefaultRelayConfig() RelayConfig {
	return RelayConfig{
		PollInterval:    100 * time.Millisecond, // Poll every 100ms for low latency
		BatchSize:       100,
		Workers:         3,
		RetentionHours:  24 * 7, // 7 days
		CleanupInterval: 1 * time.Hour,
	}
}

// Relay is the outbox relay that polls and publishes messages
// This is an alternative to CDC-based processing (Debezium)
type Relay struct {
	outboxRepo repository.OutboxRepository
	publisher  MessagePublisher
	config     RelayConfig
	logger     *log.Helper

	stopCh chan struct{}
	wg     sync.WaitGroup
}

// NewRelay creates a new outbox relay
func NewRelay(
	outboxRepo repository.OutboxRepository,
	publisher MessagePublisher,
	config RelayConfig,
	logger log.Logger,
) *Relay {
	return &Relay{
		outboxRepo: outboxRepo,
		publisher:  publisher,
		config:     config,
		logger:     log.NewHelper(log.With(logger, "module", "outbox/relay")),
		stopCh:     make(chan struct{}),
	}
}

// Start starts the outbox relay
func (r *Relay) Start(ctx context.Context) error {
	r.logger.Info("Starting outbox relay")

	// Start worker pool
	for i := 0; i < r.config.Workers; i++ {
		r.wg.Add(1)
		go r.worker(ctx, i)
	}

	// Start cleanup routine
	r.wg.Add(1)
	go r.cleanupWorker(ctx)

	return nil
}

// Stop stops the outbox relay gracefully
func (r *Relay) Stop() {
	r.logger.Info("Stopping outbox relay")
	close(r.stopCh)
	r.wg.Wait()
	r.logger.Info("Outbox relay stopped")
}

// worker processes outbox entries
func (r *Relay) worker(ctx context.Context, workerID int) {
	defer r.wg.Done()

	ticker := time.NewTicker(r.config.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-r.stopCh:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.processBatch(ctx, workerID)
		}
	}
}

// processBatch processes a batch of pending outbox entries
func (r *Relay) processBatch(ctx context.Context, workerID int) {
	tracer := otel.Tracer("outbox-relay")
	ctx, span := tracer.Start(ctx, "outbox.relay.processBatch",
		trace.WithAttributes(
			attribute.Int("worker_id", workerID),
		),
	)
	defer span.End()

	// Fetch pending entries
	entries, err := r.outboxRepo.FindPending(ctx, r.config.BatchSize)
	if err != nil {
		r.logger.Errorf("Worker %d: failed to fetch pending entries: %v", workerID, err)
		span.RecordError(err)
		return
	}

	if len(entries) == 0 {
		return
	}

	span.SetAttributes(attribute.Int("batch_size", len(entries)))
	r.logger.Debugf("Worker %d: processing %d entries", workerID, len(entries))

	// Process each entry
	for _, entry := range entries {
		if err := r.processEntry(ctx, entry); err != nil {
			r.logger.Errorf("Worker %d: failed to process entry %s: %v", workerID, entry.ID, err)
		}
	}
}

// processEntry processes a single outbox entry
func (r *Relay) processEntry(ctx context.Context, entry *entity.OutboxEntry) error {
	tracer := otel.Tracer("outbox-relay")
	ctx, span := tracer.Start(ctx, fmt.Sprintf("outbox.relay.publish.%s", entry.EventType),
		trace.WithAttributes(
			attribute.String("outbox.id", entry.ID),
			attribute.String("outbox.aggregate_type", entry.AggregateType),
			attribute.String("outbox.aggregate_id", entry.AggregateID),
			attribute.String("outbox.event_type", entry.EventType),
		),
	)
	defer span.End()

	// Deserialize the event payload
	var eventData map[string]interface{}
	if err := json.Unmarshal(entry.Payload, &eventData); err != nil {
		span.RecordError(err)
		return r.markFailed(ctx, entry.ID, fmt.Sprintf("failed to unmarshal payload: %v", err))
	}

	// Add metadata to event
	eventData["_outbox_id"] = entry.ID
	eventData["_published_at"] = time.Now().Format(time.RFC3339)

	// Publish to Kafka
	if err := r.publisher.PublishEvent(ctx, entry.AggregateID, eventData); err != nil {
		span.RecordError(err)
		return r.markFailed(ctx, entry.ID, fmt.Sprintf("failed to publish to kafka: %v", err))
	}

	// Mark as published
	if err := r.outboxRepo.MarkPublished(ctx, entry.ID); err != nil {
		span.RecordError(err)
		r.logger.Errorf("Failed to mark entry %s as published: %v", entry.ID, err)
		// Don't return error here - message was published successfully
		// The entry will be cleaned up eventually
	}

	span.SetAttributes(attribute.Bool("success", true))
	return nil
}

// markFailed marks an entry as failed
func (r *Relay) markFailed(ctx context.Context, id string, errorMsg string) error {
	return r.outboxRepo.MarkFailed(ctx, id, errorMsg)
}

// cleanupWorker periodically cleans up old published entries
func (r *Relay) cleanupWorker(ctx context.Context) {
	defer r.wg.Done()

	ticker := time.NewTicker(r.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-r.stopCh:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.cleanup(ctx)
		}
	}
}

// cleanup removes old published entries
func (r *Relay) cleanup(ctx context.Context) {
	deleted, err := r.outboxRepo.DeletePublished(ctx, r.config.RetentionHours)
	if err != nil {
		r.logger.Errorf("Cleanup failed: %v", err)
		return
	}

	if deleted > 0 {
		r.logger.Infof("Cleaned up %d published outbox entries", deleted)
	}
}

// Stats returns current outbox statistics
func (r *Relay) Stats(ctx context.Context) (*repository.OutboxStats, error) {
	return r.outboxRepo.GetStats(ctx)
}
