package mocks

import (
	"context"
	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/repository"
	"task-service/internal/domain/valueobject"
)

type MockTaskRepository struct {
	CreateFunc            func(ctx context.Context, task *aggregate.Task) error
	UpdateFunc            func(ctx context.Context, task *aggregate.Task) error
	DeleteFunc            func(ctx context.Context, tenantID, id string) error
	FindByIDFunc          func(ctx context.Context, tenantID, id string) (*aggregate.Task, error)
	FindAllFunc           func(ctx context.Context, tenantID string, page, pageSize int32, filter repository.TaskFilter) ([]*aggregate.Task, int64, error)
	FindAllWithCursorFunc func(ctx context.Context, tenantID string, cursor string, limit int32, filter repository.TaskFilter, sortBy string, sortDesc bool) (*repository.CursorResult, error)
	BulkUpdateStatusFunc  func(ctx context.Context, tenantID string, ids []string, status valueobject.TaskStatus) (int32, []string, error)
	BulkAssignFunc        func(ctx context.Context, tenantID string, ids []string, assigneeIDs []string) (int32, []string, error)
}

func (m *MockTaskRepository) Create(ctx context.Context, task *aggregate.Task) error {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, task)
	}
	return nil
}

func (m *MockTaskRepository) Update(ctx context.Context, task *aggregate.Task) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, task)
	}
	return nil
}

func (m *MockTaskRepository) Delete(ctx context.Context, tenantID, id string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, tenantID, id)
	}
	return nil
}

func (m *MockTaskRepository) FindByID(ctx context.Context, tenantID, id string) (*aggregate.Task, error) {
	if m.FindByIDFunc != nil {
		return m.FindByIDFunc(ctx, tenantID, id)
	}
	return nil, nil
}

func (m *MockTaskRepository) FindAll(ctx context.Context, tenantID string, page, pageSize int32, filter repository.TaskFilter) ([]*aggregate.Task, int64, error) {
	if m.FindAllFunc != nil {
		return m.FindAllFunc(ctx, tenantID, page, pageSize, filter)
	}
	return nil, 0, nil
}

func (m *MockTaskRepository) BulkUpdateStatus(ctx context.Context, tenantID string, ids []string, status valueobject.TaskStatus) (int32, []string, error) {
	if m.BulkUpdateStatusFunc != nil {
		return m.BulkUpdateStatusFunc(ctx, tenantID, ids, status)
	}
	return 0, nil, nil
}

func (m *MockTaskRepository) BulkAssign(ctx context.Context, tenantID string, ids []string, assigneeIDs []string) (int32, []string, error) {
	if m.BulkAssignFunc != nil {
		return m.BulkAssignFunc(ctx, tenantID, ids, assigneeIDs)
	}
	return 0, nil, nil
}

func (m *MockTaskRepository) FindAllWithCursor(ctx context.Context, tenantID string, cursor string, limit int32, filter repository.TaskFilter, sortBy string, sortDesc bool) (*repository.CursorResult, error) {
	if m.FindAllWithCursorFunc != nil {
		return m.FindAllWithCursorFunc(ctx, tenantID, cursor, limit, filter, sortBy, sortDesc)
	}
	return nil, nil
}
