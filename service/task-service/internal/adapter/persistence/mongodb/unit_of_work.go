package mongodb

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/mongo"

	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/entity"
	"task-service/internal/domain/event"
)

// UnitOfWork provides transactional operations for task and outbox
// Implements the Unit of Work pattern with Outbox Pattern
type UnitOfWork struct {
	client     *mongo.Client
	db         *mongo.Database
	taskRepo   *TaskRepository
	outboxRepo *OutboxRepository
}

// NewUnitOfWork creates a new unit of work
func NewUnitOfWork(client *mongo.Client, db *mongo.Database, taskRepo *TaskRepository, outboxRepo *OutboxRepository) *UnitOfWork {
	return &UnitOfWork{
		client:     client,
		db:         db,
		taskRepo:   taskRepo,
		outboxRepo: outboxRepo,
	}
}

// CreateTaskWithEvents creates a task and its events atomically in a transaction
func (uow *UnitOfWork) CreateTaskWithEvents(ctx context.Context, task *aggregate.Task) error {
	// Start a session for the transaction
	session, err := uow.client.StartSession()
	if err != nil {
		return fmt.Errorf("failed to start session: %w", err)
	}
	defer session.EndSession(ctx)

	// Execute transaction
	_, err = session.WithTransaction(ctx, func(sessCtx mongo.SessionContext) (interface{}, error) {
		// 1. Create task document
		if err := uow.taskRepo.Create(sessCtx, task); err != nil {
			return nil, fmt.Errorf("failed to create task: %w", err)
		}

		// 2. Create outbox entries for domain events
		outboxEntries, err := uow.createOutboxEntries(task, ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to create outbox entries: %w", err)
		}

		if len(outboxEntries) > 0 {
			if err := uow.outboxRepo.CreateMany(sessCtx, outboxEntries); err != nil {
				return nil, fmt.Errorf("failed to save outbox entries: %w", err)
			}
		}

		return nil, nil
	})

	if err != nil {
		return fmt.Errorf("transaction failed: %w", err)
	}

	// Clear domain events after successful commit
	task.ClearDomainEvents()
	return nil
}

// UpdateTaskWithEvents updates a task and its events atomically
func (uow *UnitOfWork) UpdateTaskWithEvents(ctx context.Context, task *aggregate.Task) error {
	session, err := uow.client.StartSession()
	if err != nil {
		return fmt.Errorf("failed to start session: %w", err)
	}
	defer session.EndSession(ctx)

	_, err = session.WithTransaction(ctx, func(sessCtx mongo.SessionContext) (interface{}, error) {
		// 1. Update task document
		if err := uow.taskRepo.Update(sessCtx, task); err != nil {
			return nil, fmt.Errorf("failed to update task: %w", err)
		}

		// 2. Create outbox entries for domain events
		outboxEntries, err := uow.createOutboxEntries(task, ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to create outbox entries: %w", err)
		}

		if len(outboxEntries) > 0 {
			if err := uow.outboxRepo.CreateMany(sessCtx, outboxEntries); err != nil {
				return nil, fmt.Errorf("failed to save outbox entries: %w", err)
			}
		}

		return nil, nil
	})

	if err != nil {
		return fmt.Errorf("transaction failed: %w", err)
	}

	task.ClearDomainEvents()
	return nil
}

// DeleteTaskWithEvents deletes a task and publishes delete event atomically
func (uow *UnitOfWork) DeleteTaskWithEvents(ctx context.Context, tenantID, taskID string, deleteEvent event.DomainEvent) error {
	session, err := uow.client.StartSession()
	if err != nil {
		return fmt.Errorf("failed to start session: %w", err)
	}
	defer session.EndSession(ctx)

	_, err = session.WithTransaction(ctx, func(sessCtx mongo.SessionContext) (interface{}, error) {
		// 1. Delete task document
		if err := uow.taskRepo.Delete(sessCtx, tenantID, taskID); err != nil {
			return nil, fmt.Errorf("failed to delete task: %w", err)
		}

		// 2. Create outbox entry for delete event
		if deleteEvent != nil {
			payload, err := json.Marshal(deleteEvent)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete event: %w", err)
			}

			outboxEntry := entity.NewOutboxEntry(
				uuid.New().String(),
				"Task",
				taskID,
				deleteEvent.EventName(),
				payload,
				map[string]string{
					"tenant_id": tenantID,
				},
			)

			if err := uow.outboxRepo.Create(sessCtx, outboxEntry); err != nil {
				return nil, fmt.Errorf("failed to save outbox entry: %w", err)
			}
		}

		return nil, nil
	})

	return err
}

// createOutboxEntries converts domain events to outbox entries
func (uow *UnitOfWork) createOutboxEntries(task *aggregate.Task, ctx context.Context) ([]*entity.OutboxEntry, error) {
	events := task.DomainEvents()
	if len(events) == 0 {
		return nil, nil
	}

	entries := make([]*entity.OutboxEntry, 0, len(events))

	for _, evt := range events {
		payload, err := json.Marshal(evt)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal event %s: %w", evt.EventName(), err)
		}

		// Extract trace ID from context if available
		metadata := map[string]string{
			"tenant_id":    task.TenantID,
			"aggregate_id": task.ID,
		}

		entry := entity.NewOutboxEntry(
			uuid.New().String(),
			"Task",
			evt.AggregateID(),
			evt.EventName(),
			payload,
			metadata,
		)

		entries = append(entries, entry)
	}

	return entries, nil
}

// TaskRepository returns the task repository
func (uow *UnitOfWork) TaskRepository() *TaskRepository {
	return uow.taskRepo
}

// OutboxRepository returns the outbox repository
func (uow *UnitOfWork) OutboxRepository() *OutboxRepository {
	return uow.outboxRepo
}
