package entity

import (
	"time"
)

// OutboxStatus represents the status of an outbox entry
type OutboxStatus string

const (
	OutboxStatusPending   OutboxStatus = "pending"
	OutboxStatusPublished OutboxStatus = "published"
	OutboxStatusFailed    OutboxStatus = "failed"
)

// OutboxEntry represents an event in the transactional outbox
// This implements the Outbox Pattern for reliable event publishing
type OutboxEntry struct {
	ID            string            `bson:"_id"`
	AggregateType string            `bson:"aggregate_type"` // e.g., "Task"
	AggregateID   string            `bson:"aggregate_id"`   // e.g., task ID
	EventType     string            `bson:"event_type"`     // e.g., "TaskCreated"
	Payload       []byte            `bson:"payload"`        // JSON serialized event
	Metadata      map[string]string `bson:"metadata"`       // trace_id, tenant_id, etc.
	Status        OutboxStatus      `bson:"status"`
	RetryCount    int               `bson:"retry_count"`
	MaxRetries    int               `bson:"max_retries"`
	CreatedAt     time.Time         `bson:"created_at"`
	UpdatedAt     time.Time         `bson:"updated_at"`
	PublishedAt   *time.Time        `bson:"published_at,omitempty"`
	ErrorMessage  string            `bson:"error_message,omitempty"`
}

// NewOutboxEntry creates a new outbox entry
func NewOutboxEntry(id, aggregateType, aggregateID, eventType string, payload []byte, metadata map[string]string) *OutboxEntry {
	now := time.Now()
	return &OutboxEntry{
		ID:            id,
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		EventType:     eventType,
		Payload:       payload,
		Metadata:      metadata,
		Status:        OutboxStatusPending,
		RetryCount:    0,
		MaxRetries:    5,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
}

// MarkPublished marks the entry as successfully published
func (o *OutboxEntry) MarkPublished() {
	now := time.Now()
	o.Status = OutboxStatusPublished
	o.PublishedAt = &now
	o.UpdatedAt = now
}

// MarkFailed marks the entry as failed with error message
func (o *OutboxEntry) MarkFailed(err string) {
	o.Status = OutboxStatusFailed
	o.ErrorMessage = err
	o.RetryCount++
	o.UpdatedAt = time.Now()

	// Reset to pending if retries available
	if o.RetryCount < o.MaxRetries {
		o.Status = OutboxStatusPending
	}
}

// CanRetry checks if the entry can be retried
func (o *OutboxEntry) CanRetry() bool {
	return o.RetryCount < o.MaxRetries
}
