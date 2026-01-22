package mongodb

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/repository"
	"task-service/internal/domain/valueobject"
)

// TaskRepository implements repository.TaskRepository for MongoDB
type TaskRepository struct {
	collection *mongo.Collection
}

// TaskDocument represents the MongoDB document structure for ClickUp tasks
type TaskDocument struct {
	ID                  string            `bson:"_id"`
	TenantID            string            `bson:"tenant_id"`
	Title               string            `bson:"title"`
	Description         string            `bson:"description"`
	Status              int32             `bson:"status"`
	Priority            int32             `bson:"priority"`
	AssigneeIDs         []string          `bson:"assignee_ids"`
	WatcherIDs          []string          `bson:"watcher_ids"`
	CreatorID           string            `bson:"creator_id"`
	ProjectID           string            `bson:"project_id"`
	SpaceID             string            `bson:"space_id"`
	ParentTaskID        string            `bson:"parent_task_id,omitempty"`
	CreatedAt           time.Time         `bson:"created_at"`
	UpdatedAt           time.Time         `bson:"updated_at"`
	DueDate             *time.Time        `bson:"due_date,omitempty"`
	StartDate           *time.Time        `bson:"start_date,omitempty"`
	CompletedAt         *time.Time        `bson:"completed_at,omitempty"`
	TimeEstimateMinutes int32             `bson:"time_estimate_minutes"`
	TimeTrackedMinutes  int32             `bson:"time_tracked_minutes"`
	Tags                []string          `bson:"tags"`
	DependencyIDs       []string          `bson:"dependency_ids"`
	OrderIndex          int32             `bson:"order_index"`
	CustomFields        map[string]string `bson:"custom_fields,omitempty"`
}

// NewTaskRepository creates a new MongoDB task repository with ClickUp indexes
func NewTaskRepository(db *mongo.Database) *TaskRepository {
	collection := db.Collection("tasks")

	// Create indexes
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexes := []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "tenant_id", Value: 1},
				{Key: "project_id", Value: 1},
				{Key: "order_index", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "tenant_id", Value: 1},
				{Key: "assignee_ids", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "tenant_id", Value: 1},
				{Key: "status", Value: 1},
			},
		},
		{
			Keys: bson.D{{Key: "title", Value: "text"}, {Key: "description", Value: "text"}},
		},
	}

	_, _ = collection.Indexes().CreateMany(ctx, indexes)

	return &TaskRepository{collection: collection}
}

func (r *TaskRepository) Create(ctx context.Context, task *aggregate.Task) error {
	doc := r.toDocument(task)
	_, err := r.collection.InsertOne(ctx, doc)
	return err
}

func (r *TaskRepository) Update(ctx context.Context, task *aggregate.Task) error {
	doc := r.toDocument(task)
	filter := bson.M{"_id": task.ID, "tenant_id": task.TenantID}
	_, err := r.collection.ReplaceOne(ctx, filter, doc)
	return err
}

func (r *TaskRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id, "tenant_id": tenantID})
	return err
}

func (r *TaskRepository) FindByID(ctx context.Context, tenantID, id string) (*aggregate.Task, error) {
	var doc TaskDocument
	err := r.collection.FindOne(ctx, bson.M{"_id": id, "tenant_id": tenantID}).Decode(&doc)
	if err != nil {
		return nil, err
	}
	return r.toAggregate(&doc), nil
}

func (r *TaskRepository) FindAll(ctx context.Context, tenantID string, page, pageSize int32, filter repository.TaskFilter) ([]*aggregate.Task, int64, error) {
	bsonFilter := bson.M{"tenant_id": tenantID}

	if filter.ProjectID != "" {
		bsonFilter["project_id"] = filter.ProjectID
	}
	if filter.SpaceID != "" {
		bsonFilter["space_id"] = filter.SpaceID
	}
	if len(filter.Statuses) > 0 {
		bsonFilter["status"] = bson.M{"$in": filter.Statuses}
	}
	if len(filter.AssigneeIDs) > 0 {
		bsonFilter["assignee_ids"] = bson.M{"$in": filter.AssigneeIDs}
	}
	if filter.SearchQuery != "" {
		bsonFilter["$text"] = bson.M{"$search": filter.SearchQuery}
	}

	total, _ := r.collection.CountDocuments(ctx, bsonFilter)

	findOptions := options.Find()
	findOptions.SetLimit(int64(pageSize))
	findOptions.SetSkip(int64((page - 1) * pageSize))
	findOptions.SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := r.collection.Find(ctx, bsonFilter, findOptions)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var tasks []*aggregate.Task
	for cursor.Next(ctx) {
		var doc TaskDocument
		if err := cursor.Decode(&doc); err != nil {
			return nil, 0, err
		}
		tasks = append(tasks, r.toAggregate(&doc))
	}

	return tasks, total, nil
}

func (r *TaskRepository) BulkUpdateStatus(ctx context.Context, tenantID string, ids []string, status valueobject.TaskStatus) (int32, []string, error) {
	filter := bson.M{"_id": bson.M{"$in": ids}, "tenant_id": tenantID}
	update := bson.M{"$set": bson.M{"status": int32(status), "updated_at": time.Now()}}

	result, err := r.collection.UpdateMany(ctx, filter, update)
	if err != nil {
		return 0, nil, err
	}
	return int32(result.ModifiedCount), nil, nil
}

func (r *TaskRepository) BulkAssign(ctx context.Context, tenantID string, ids []string, assigneeIDs []string) (int32, []string, error) {
	filter := bson.M{"_id": bson.M{"$in": ids}, "tenant_id": tenantID}
	update := bson.M{"$set": bson.M{"assignee_ids": assigneeIDs, "updated_at": time.Now()}}

	result, err := r.collection.UpdateMany(ctx, filter, update)
	if err != nil {
		return 0, nil, err
	}
	return int32(result.ModifiedCount), nil, nil
}

// Helpers

func (r *TaskRepository) toDocument(task *aggregate.Task) *TaskDocument {
	return &TaskDocument{
		ID:                  task.ID,
		TenantID:            task.TenantID,
		Title:               task.Title,
		Description:         task.Description,
		Status:              int32(task.Status),
		Priority:            int32(task.Priority),
		AssigneeIDs:         task.AssigneeIDs,
		WatcherIDs:          task.WatcherIDs,
		CreatorID:           task.CreatorID,
		ProjectID:           task.ProjectID,
		SpaceID:             task.SpaceID,
		ParentTaskID:        task.ParentTaskID,
		CreatedAt:           task.CreatedAt,
		UpdatedAt:           task.UpdatedAt,
		DueDate:             task.DueDate,
		StartDate:           task.StartDate,
		CompletedAt:         task.CompletedAt,
		TimeEstimateMinutes: task.TimeEstimateMinutes,
		TimeTrackedMinutes:  task.TimeTrackedMinutes,
		Tags:                task.Tags,
		DependencyIDs:       task.DependencyIDs,
		OrderIndex:          task.OrderIndex,
		CustomFields:        task.CustomFields,
	}
}

func (r *TaskRepository) toAggregate(doc *TaskDocument) *aggregate.Task {
	return &aggregate.Task{
		ID:                  doc.ID,
		TenantID:            doc.TenantID,
		Title:               doc.Title,
		Description:         doc.Description,
		Status:              valueobject.TaskStatus(doc.Status),
		Priority:            valueobject.TaskPriority(doc.Priority),
		AssigneeIDs:         doc.AssigneeIDs,
		WatcherIDs:          doc.WatcherIDs,
		CreatorID:           doc.CreatorID,
		ProjectID:           doc.ProjectID,
		SpaceID:             doc.SpaceID,
		ParentTaskID:        doc.ParentTaskID,
		CreatedAt:           doc.CreatedAt,
		UpdatedAt:           doc.UpdatedAt,
		DueDate:             doc.DueDate,
		StartDate:           doc.StartDate,
		CompletedAt:         doc.CompletedAt,
		TimeEstimateMinutes: doc.TimeEstimateMinutes,
		TimeTrackedMinutes:  doc.TimeTrackedMinutes,
		Tags:                doc.Tags,
		DependencyIDs:       doc.DependencyIDs,
		OrderIndex:          doc.OrderIndex,
		CustomFields:        doc.CustomFields,
	}
}
