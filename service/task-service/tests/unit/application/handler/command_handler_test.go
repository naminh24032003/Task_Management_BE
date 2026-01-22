package handler_test

import (
	"context"
	"task-service/internal/application/command"
	"task-service/internal/application/handler"
	"task-service/internal/domain/service"
	"task-service/tests/mocks"
	"testing"
)

type MockEventPublisher struct {
	PublishFunc func(ctx context.Context, events []interface{}) error
}

func (m *MockEventPublisher) Publish(ctx context.Context, events []interface{}) error {
	if m.PublishFunc != nil {
		return m.PublishFunc(ctx, events)
	}
	return nil
}

func TestHandleCreateTask(t *testing.T) {
	repo := &mocks.MockTaskRepository{}
	publisher := &MockEventPublisher{}
	domainSvc := service.NewTaskDomainService(repo)

	h := handler.NewCommandHandler(repo, domainSvc, publisher)

	cmd := &command.CreateTaskCommand{
		TenantID:  "tenant-1",
		Title:     "Test Task",
		ProjectID: "proj-1",
		CreatorID: "user-1",
	}

	id, err := h.HandleCreateTask(context.Background(), cmd)
	if err != nil {
		t.Fatalf("HandleCreateTask failed: %v", err)
	}

	if id == "" {
		t.Error("expected non-empty task ID")
	}
}
