package repository

import (
	"context"

	"task-service/internal/domain/entity"
)

// OutboxRepository defines the interface for outbox persistence
type OutboxRepository interface {
	// Create creates a new outbox entry
	Create(ctx context.Context, entry *entity.OutboxEntry) error

	// CreateMany creates multiple outbox entries in a batch
	CreateMany(ctx context.Context, entries []*entity.OutboxEntry) error

	// FindPending finds pending entries for processing (with limit)
	FindPending(ctx context.Context, limit int) ([]*entity.OutboxEntry, error)

	// FindByID finds an outbox entry by ID
	FindByID(ctx context.Context, id string) (*entity.OutboxEntry, error)

	// MarkPublished marks an entry as published
	MarkPublished(ctx context.Context, id string) error

	// MarkFailed marks an entry as failed
	MarkFailed(ctx context.Context, id string, errorMsg string) error

	// DeletePublished deletes published entries older than retention period
	DeletePublished(ctx context.Context, olderThanHours int) (int64, error)

	// GetStats returns outbox statistics
	GetStats(ctx context.Context) (*OutboxStats, error)
}

// OutboxStats contains statistics about the outbox
type OutboxStats struct {
	PendingCount   int64 `json:"pending_count"`
	PublishedCount int64 `json:"published_count"`
	FailedCount    int64 `json:"failed_count"`
}
