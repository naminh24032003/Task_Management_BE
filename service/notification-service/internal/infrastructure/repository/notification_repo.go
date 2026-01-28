package repository

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"notification-service/internal/domain/notification"
)

const (
	databaseName   = "notification_db"
	collectionName = "notifications"
)

// MongoNotificationRepository implements NotificationRepository using MongoDB
type MongoNotificationRepository struct {
	collection *mongo.Collection
}

// MongoConfig contains MongoDB connection configuration
type MongoConfig struct {
	URI      string
	Database string
}

// NewMongoNotificationRepository creates a new MongoNotificationRepository
func NewMongoNotificationRepository(client *mongo.Client, database string) *MongoNotificationRepository {
	if database == "" {
		database = databaseName
	}
	collection := client.Database(database).Collection(collectionName)
	return &MongoNotificationRepository{
		collection: collection,
	}
}

// NewMongoClient creates a new MongoDB client
func NewMongoClient(ctx context.Context, config MongoConfig) (*mongo.Client, error) {
	clientOptions := options.Client().ApplyURI(config.URI)

	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping to verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	return client, nil
}

// Create creates a new notification
func (r *MongoNotificationRepository) Create(ctx context.Context, n *notification.Notification) error {
	_, err := r.collection.InsertOne(ctx, n)
	if err != nil {
		return fmt.Errorf("failed to create notification: %w", err)
	}
	return nil
}

// Update updates an existing notification
func (r *MongoNotificationRepository) Update(ctx context.Context, n *notification.Notification) error {
	n.UpdatedAt = time.Now()
	filter := bson.M{"_id": n.ID}
	update := bson.M{"$set": n}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update notification: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("notification not found: %s", n.ID)
	}

	return nil
}

// FindByID finds a notification by ID
func (r *MongoNotificationRepository) FindByID(ctx context.Context, id string) (*notification.Notification, error) {
	var n notification.Notification
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&n)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find notification: %w", err)
	}
	return &n, nil
}

// FindByUserID finds all notifications for a user
func (r *MongoNotificationRepository) FindByUserID(ctx context.Context, userID string, limit, offset int) ([]*notification.Notification, error) {
	filter := bson.M{"user_id": userID}
	opts := options.Find().
		SetSort(bson.M{"created_at": -1}).
		SetLimit(int64(limit)).
		SetSkip(int64(offset))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find notifications: %w", err)
	}
	defer cursor.Close(ctx)

	var notifications []*notification.Notification
	if err := cursor.All(ctx, &notifications); err != nil {
		return nil, fmt.Errorf("failed to decode notifications: %w", err)
	}

	return notifications, nil
}

// FindUnreadByUserID finds unread notifications for a user
func (r *MongoNotificationRepository) FindUnreadByUserID(ctx context.Context, userID string, limit, offset int) ([]*notification.Notification, error) {
	filter := bson.M{
		"user_id": userID,
		"status": bson.M{
			"$in": []notification.Status{notification.StatusPending, notification.StatusSent},
		},
	}
	opts := options.Find().
		SetSort(bson.M{"created_at": -1}).
		SetLimit(int64(limit)).
		SetSkip(int64(offset))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find unread notifications: %w", err)
	}
	defer cursor.Close(ctx)

	var notifications []*notification.Notification
	if err := cursor.All(ctx, &notifications); err != nil {
		return nil, fmt.Errorf("failed to decode notifications: %w", err)
	}

	return notifications, nil
}

// CountUnreadByUserID counts unread notifications for a user
func (r *MongoNotificationRepository) CountUnreadByUserID(ctx context.Context, userID string) (int64, error) {
	filter := bson.M{
		"user_id": userID,
		"status": bson.M{
			"$in": []notification.Status{notification.StatusPending, notification.StatusSent},
		},
	}

	count, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return 0, fmt.Errorf("failed to count unread notifications: %w", err)
	}

	return count, nil
}

// MarkAsRead marks a notification as read
func (r *MongoNotificationRepository) MarkAsRead(ctx context.Context, id string) error {
	now := time.Now()
	filter := bson.M{"_id": id}
	update := bson.M{
		"$set": bson.M{
			"status":     notification.StatusRead,
			"read_at":    now,
			"updated_at": now,
		},
	}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("notification not found: %s", id)
	}

	return nil
}

// MarkAllAsReadByUserID marks all notifications as read for a user
func (r *MongoNotificationRepository) MarkAllAsReadByUserID(ctx context.Context, userID string) error {
	now := time.Now()
	filter := bson.M{
		"user_id": userID,
		"status": bson.M{
			"$in": []notification.Status{notification.StatusPending, notification.StatusSent},
		},
	}
	update := bson.M{
		"$set": bson.M{
			"status":     notification.StatusRead,
			"read_at":    now,
			"updated_at": now,
		},
	}

	_, err := r.collection.UpdateMany(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to mark all notifications as read: %w", err)
	}

	return nil
}

// Delete deletes a notification
func (r *MongoNotificationRepository) Delete(ctx context.Context, id string) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return fmt.Errorf("failed to delete notification: %w", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("notification not found: %s", id)
	}

	return nil
}

// DeleteByUserID deletes all notifications for a user
func (r *MongoNotificationRepository) DeleteByUserID(ctx context.Context, userID string) error {
	_, err := r.collection.DeleteMany(ctx, bson.M{"user_id": userID})
	if err != nil {
		return fmt.Errorf("failed to delete notifications for user: %w", err)
	}

	return nil
}

// CreateIndexes creates necessary indexes for the collection
func (r *MongoNotificationRepository) CreateIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}},
			Options: options.Index().SetName("idx_user_id_created_at"),
		},
		{
			Keys:    bson.D{{Key: "user_id", Value: 1}, {Key: "status", Value: 1}},
			Options: options.Index().SetName("idx_user_id_status"),
		},
		{
			Keys:    bson.D{{Key: "source_event", Value: 1}, {Key: "source_id", Value: 1}},
			Options: options.Index().SetName("idx_source"),
		},
		{
			Keys:    bson.D{{Key: "created_at", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(30 * 24 * 60 * 60).SetName("idx_ttl"), // 30 days TTL
		},
	}

	_, err := r.collection.Indexes().CreateMany(ctx, indexes)
	if err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}

	return nil
}
