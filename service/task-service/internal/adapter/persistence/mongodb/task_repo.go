package mongodb

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/valueobject"
)

// TaskRepository implements repository.TaskRepository for MongoDB
type TaskRepository struct {
	collection *mongo.Collection
}

// TaskDocument represents the MongoDB document structure
type TaskDocument struct {
	ID          string     `bson:"_id"`
	Title       string     `bson:"title"`
	Description string     `bson:"description"`
	Status      string     `bson:"status"`
	Priority    string     `bson:"priority"`
	AssigneeID  string     `bson:"assignee_id,omitempty"`
	ProjectID   string     `bson:"project_id"`
	DueDate     *time.Time `bson:"due_date,omitempty"`
	CreatedAt   time.Time  `bson:"created_at"`
	UpdatedAt   time.Time  `bson:"updated_at"`
}

// NewTaskRepository creates a new MongoDB task repository
func NewTaskRepository(db *mongo.Database) *TaskRepository {
	collection := db.Collection("tasks")

	// Create indexes
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexes := []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "project_id", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "assignee_id", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "status", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "created_at", Value: -1}},
		},
	}

	_, err := collection.Indexes().CreateMany(ctx, indexes)
	if err != nil {
		// Log error but don't fail - indexes might already exist
		fmt.Printf("Warning: failed to create indexes: %v\n", err)
	}

	return &TaskRepository{collection: collection}
}

// Create saves a new task
func (r *TaskRepository) Create(ctx context.Context, task *aggregate.Task) error {
	doc := r.toDocument(task)

	_, err := r.collection.InsertOne(ctx, doc)
	if err != nil {
		return fmt.Errorf("failed to insert task: %w", err)
	}

	return nil
}

// FindByID finds a task by ID
func (r *TaskRepository) FindByID(ctx context.Context, id string) (*aggregate.Task, error) {
	var doc TaskDocument

	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&doc)
	if err == mongo.ErrNoDocuments {
		return nil, fmt.Errorf("task not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find task: %w", err)
	}

	return r.toAggregate(&doc)
}

// Update updates an existing task
func (r *TaskRepository) Update(ctx context.Context, task *aggregate.Task) error {
	doc := r.toDocument(task)

	filter := bson.M{"_id": task.ID}
	update := bson.M{
		"$set": bson.M{
			"title":       doc.Title,
			"description": doc.Description,
			"status":      doc.Status,
			"priority":    doc.Priority,
			"assignee_id": doc.AssigneeID,
			"due_date":    doc.DueDate,
			"updated_at":  doc.UpdatedAt,
		},
	}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update task: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("task not found")
	}

	return nil
}

// Delete deletes a task
func (r *TaskRepository) Delete(ctx context.Context, id string) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return fmt.Errorf("failed to delete task: %w", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("task not found")
	}

	return nil
}

// List returns a paginated list of tasks
func (r *TaskRepository) List(ctx context.Context, offset, limit int) ([]*aggregate.Task, error) {
	findOptions := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64(offset)).
		SetLimit(int64(limit))

	return r.findTasks(ctx, bson.M{}, findOptions)
}

// FindByProjectID finds tasks by project ID
func (r *TaskRepository) FindByProjectID(ctx context.Context, projectID string, offset, limit int) ([]*aggregate.Task, error) {
	filter := bson.M{"project_id": projectID}
	findOptions := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64(offset)).
		SetLimit(int64(limit))

	return r.findTasks(ctx, filter, findOptions)
}

// FindByAssigneeID finds tasks by assignee ID
func (r *TaskRepository) FindByAssigneeID(ctx context.Context, assigneeID string, offset, limit int) ([]*aggregate.Task, error) {
	filter := bson.M{"assignee_id": assigneeID}
	findOptions := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64(offset)).
		SetLimit(int64(limit))

	return r.findTasks(ctx, filter, findOptions)
}

// FindByStatus finds tasks by status
func (r *TaskRepository) FindByStatus(ctx context.Context, status string, offset, limit int) ([]*aggregate.Task, error) {
	filter := bson.M{"status": status}
	findOptions := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64(offset)).
		SetLimit(int64(limit))

	return r.findTasks(ctx, filter, findOptions)
}

// Helper methods

func (r *TaskRepository) findTasks(ctx context.Context, filter bson.M, opts *options.FindOptions) ([]*aggregate.Task, error) {
	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find tasks: %w", err)
	}
	defer cursor.Close(ctx)

	var tasks []*aggregate.Task
	for cursor.Next(ctx) {
		var doc TaskDocument
		if err := cursor.Decode(&doc); err != nil {
			return nil, fmt.Errorf("failed to decode task: %w", err)
		}

		task, err := r.toAggregate(&doc)
		if err != nil {
			return nil, err
		}

		tasks = append(tasks, task)
	}

	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("cursor error: %w", err)
	}

	return tasks, nil
}

func (r *TaskRepository) toDocument(task *aggregate.Task) *TaskDocument {
	return &TaskDocument{
		ID:          task.ID,
		Title:       task.Title,
		Description: task.Description,
		Status:      task.Status.String(),
		Priority:    task.Priority.String(),
		AssigneeID:  task.AssigneeID,
		ProjectID:   task.ProjectID,
		DueDate:     task.DueDate,
		CreatedAt:   task.CreatedAt,
		UpdatedAt:   task.UpdatedAt,
	}
}

func (r *TaskRepository) toAggregate(doc *TaskDocument) (*aggregate.Task, error) {
	task, err := aggregate.NewTask(
		doc.ID,
		doc.Title,
		doc.Description,
		doc.ProjectID,
		valueobject.ParsePriority(doc.Priority),
		doc.DueDate,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create task aggregate: %w", err)
	}

	task.Status = valueobject.TaskStatus(doc.Status)
	task.AssigneeID = doc.AssigneeID
	task.CreatedAt = doc.CreatedAt
	task.UpdatedAt = doc.UpdatedAt

	return task, nil
}
