package mocks

import (
	"context"
	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/event"
)

// MockUnitOfWork implements port.UnitOfWork for testing
type MockUnitOfWork struct {
	CreateTaskWithEventsFunc func(ctx context.Context, task *aggregate.Task) error
	UpdateTaskWithEventsFunc func(ctx context.Context, task *aggregate.Task) error
	DeleteTaskWithEventsFunc func(ctx context.Context, tenantID, taskID string, deleteEvent event.DomainEvent) error
}

func (m *MockUnitOfWork) CreateTaskWithEvents(ctx context.Context, task *aggregate.Task) error {
	if m.CreateTaskWithEventsFunc != nil {
		return m.CreateTaskWithEventsFunc(ctx, task)
	}
	return nil
}

func (m *MockUnitOfWork) UpdateTaskWithEvents(ctx context.Context, task *aggregate.Task) error {
	if m.UpdateTaskWithEventsFunc != nil {
		return m.UpdateTaskWithEventsFunc(ctx, task)
	}
	return nil
}

func (m *MockUnitOfWork) DeleteTaskWithEvents(ctx context.Context, tenantID, taskID string, deleteEvent event.DomainEvent) error {
	if m.DeleteTaskWithEventsFunc != nil {
		return m.DeleteTaskWithEventsFunc(ctx, tenantID, taskID, deleteEvent)
	}
	return nil
}

// MockTaskFinder implements port.TaskFinder for testing
type MockTaskFinder struct {
	FindByIDFunc func(ctx context.Context, tenantID, id string) (*aggregate.Task, error)
}

func (m *MockTaskFinder) FindByID(ctx context.Context, tenantID, id string) (*aggregate.Task, error) {
	if m.FindByIDFunc != nil {
		return m.FindByIDFunc(ctx, tenantID, id)
	}
	return nil, nil
}
