package mongodb

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"task-service/internal/domain/entity"
	"task-service/internal/domain/repository"
)

// OutboxRepository implements repository.OutboxRepository for MongoDB
type OutboxRepository struct {
	collection *mongo.Collection
}

// NewOutboxRepository creates a new MongoDB outbox repository
func NewOutboxRepository(db *mongo.Database) *OutboxRepository {
	collection := db.Collection("outbox")

	// Create indexes for efficient querying
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexes := []mongo.IndexModel{
		{
			// Index for polling pending messages (status + created_at for ordering)
			Keys: bson.D{
				{Key: "status", Value: 1},
				{Key: "created_at", Value: 1},
			},
		},
		{
			// Index for CDC - Debezium will use this
			Keys: bson.D{
				{Key: "aggregate_type", Value: 1},
				{Key: "aggregate_id", Value: 1},
			},
		},
		{
			// TTL index for automatic cleanup of published messages (7 days)
			Keys: bson.D{{Key: "published_at", Value: 1}},
			Options: options.Index().
				SetExpireAfterSeconds(7 * 24 * 60 * 60). // 7 days
				SetPartialFilterExpression(bson.M{"status": entity.OutboxStatusPublished}),
		},
	}

	_, _ = collection.Indexes().CreateMany(ctx, indexes)

	return &OutboxRepository{collection: collection}
}

// Create creates a new outbox entry
func (r *OutboxRepository) Create(ctx context.Context, entry *entity.OutboxEntry) error {
	_, err := r.collection.InsertOne(ctx, entry)
	return err
}

// CreateMany creates multiple outbox entries in a batch
func (r *OutboxRepository) CreateMany(ctx context.Context, entries []*entity.OutboxEntry) error {
	if len(entries) == 0 {
		return nil
	}

	docs := make([]interface{}, len(entries))
	for i, entry := range entries {
		docs[i] = entry
	}

	_, err := r.collection.InsertMany(ctx, docs)
	return err
}

// FindPending finds pending entries for processing
func (r *OutboxRepository) FindPending(ctx context.Context, limit int) ([]*entity.OutboxEntry, error) {
	filter := bson.M{
		"status": entity.OutboxStatusPending,
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: 1}}). // FIFO ordering
		SetLimit(int64(limit))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var entries []*entity.OutboxEntry
	if err := cursor.All(ctx, &entries); err != nil {
		return nil, err
	}

	return entries, nil
}

// FindByID finds an outbox entry by ID
func (r *OutboxRepository) FindByID(ctx context.Context, id string) (*entity.OutboxEntry, error) {
	var entry entity.OutboxEntry
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&entry)
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

// MarkPublished marks an entry as published
func (r *OutboxRepository) MarkPublished(ctx context.Context, id string) error {
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"status":       entity.OutboxStatusPublished,
			"published_at": now,
			"updated_at":   now,
		},
	}

	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, update)
	return err
}

// MarkFailed marks an entry as failed
func (r *OutboxRepository) MarkFailed(ctx context.Context, id string, errorMsg string) error {
	// First, get the current entry to check retry count
	entry, err := r.FindByID(ctx, id)
	if err != nil {
		return err
	}

	newStatus := entity.OutboxStatusPending
	if entry.RetryCount+1 >= entry.MaxRetries {
		newStatus = entity.OutboxStatusFailed
	}

	update := bson.M{
		"$set": bson.M{
			"status":        newStatus,
			"error_message": errorMsg,
			"updated_at":    time.Now(),
		},
		"$inc": bson.M{
			"retry_count": 1,
		},
	}

	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": id}, update)
	return err
}

// DeletePublished deletes published entries older than retention period
func (r *OutboxRepository) DeletePublished(ctx context.Context, olderThanHours int) (int64, error) {
	cutoff := time.Now().Add(-time.Duration(olderThanHours) * time.Hour)

	filter := bson.M{
		"status":       entity.OutboxStatusPublished,
		"published_at": bson.M{"$lt": cutoff},
	}

	result, err := r.collection.DeleteMany(ctx, filter)
	if err != nil {
		return 0, err
	}

	return result.DeletedCount, nil
}

// GetStats returns outbox statistics
func (r *OutboxRepository) GetStats(ctx context.Context) (*repository.OutboxStats, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.M{
			"_id":   "$status",
			"count": bson.M{"$sum": 1},
		}}},
	}

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	stats := &repository.OutboxStats{}
	for cursor.Next(ctx) {
		var result struct {
			ID    string `bson:"_id"`
			Count int64  `bson:"count"`
		}
		if err := cursor.Decode(&result); err != nil {
			continue
		}

		switch entity.OutboxStatus(result.ID) {
		case entity.OutboxStatusPending:
			stats.PendingCount = result.Count
		case entity.OutboxStatusPublished:
			stats.PublishedCount = result.Count
		case entity.OutboxStatusFailed:
			stats.FailedCount = result.Count
		}
	}

	return stats, nil
}
