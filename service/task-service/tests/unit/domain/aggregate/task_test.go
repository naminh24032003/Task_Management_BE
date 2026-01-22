package aggregate_test

import (
	"task-service/internal/domain/aggregate"
	"testing"
)

func TestNewTask(t *testing.T) {
	id := "test-id"
	tenantID := "tenant-1"
	title := "Test Task"
	creatorID := "user-1"
	projectID := "project-1"
	spaceID := "space-1"

	task, err := aggregate.NewTask(id, tenantID, title, creatorID, projectID, spaceID)
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}

	if task.ID != id {
		t.Errorf("expected ID %s, got %s", id, task.ID)
	}
	if task.Title != title {
		t.Errorf("expected Title %s, got %s", title, task.Title)
	}
	if task.ProjectID != projectID {
		t.Errorf("expected ProjectID %s, got %s", projectID, task.ProjectID)
	}
}
