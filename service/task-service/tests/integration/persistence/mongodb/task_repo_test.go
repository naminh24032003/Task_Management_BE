package mongodb_test

import (
	"context"
	"os"
	"testing"
	"time"

	"task-service/internal/adapter/persistence/mongodb"
	"task-service/internal/domain/aggregate"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestTaskRepository_Create(t *testing.T) {
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		t.Skip("Skipping integration test: MONGODB_URI not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		t.Fatalf("failed to connect to mongo: %v", err)
	}

	repo := mongodb.NewTaskRepository(client.Database("testdb"))

	task, _ := aggregate.NewTask("task-123", "tenant-1", "Integration Task", "user-1", "proj-1", "space-1")

	err = repo.Create(ctx, task)
	if err != nil {
		t.Fatalf("failed to create task in mongo: %v", err)
	}

	// Clean up
	_ = client.Database("testdb").Collection("tasks").Drop(ctx)
}
