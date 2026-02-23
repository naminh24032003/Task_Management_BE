package handler_test

import (
	"context"
	"task-service/internal/application/command"
	"task-service/internal/application/handler"
	"task-service/internal/domain/service"
	"task-service/tests/mocks"
	"testing"
)

func TestHandleCreateTask(t *testing.T) {
	repo := &mocks.MockTaskRepository{}
	uow := &mocks.MockUnitOfWork{}
	finder := &mocks.MockTaskFinder{}
	domainSvc := service.NewTaskDomainService(repo)

	h := handler.NewCommandHandlerOutbox(uow, finder, domainSvc, nil)

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
