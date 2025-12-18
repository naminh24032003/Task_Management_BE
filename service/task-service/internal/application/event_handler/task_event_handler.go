package event_handler

import (
	"context"
	"fmt"

	"task-service/internal/domain/event"
)

// TaskEventHandler handles domain events
type TaskEventHandler struct {
	// Add dependencies like notification service, audit log, etc.
}

// NewTaskEventHandler creates a new event handler
func NewTaskEventHandler() *TaskEventHandler {
	return &TaskEventHandler{}
}

// HandleTaskCreated handles TaskCreatedEvent
func (h *TaskEventHandler) HandleTaskCreated(ctx context.Context, evt *event.TaskCreatedEvent) error {
	fmt.Printf("[Event] Task created: ID=%s Title=%s ProjectID=%s\n", evt.AggregateID(), evt.Title, evt.ProjectID)

	// TODO:
	// - Update project task count
	// - Notify project members
	// - Log audit trail

	return nil
}

// HandleTaskCompleted handles TaskCompletedEvent
func (h *TaskEventHandler) HandleTaskCompleted(ctx context.Context, evt *event.TaskCompletedEvent) error {
	fmt.Printf("[Event] Task completed: ID=%s\n", evt.AggregateID())

	// TODO:
	// - Update project progress
	// - Notify assignee/reporter
	// - Update user statistics

	return nil
}

// HandleTaskAssigned handles TaskAssignedEvent
func (h *TaskEventHandler) HandleTaskAssigned(ctx context.Context, evt *event.TaskAssignedEvent) error {
	fmt.Printf("[Event] Task assigned: ID=%s OldAssignee=%s NewAssignee=%s\n",
		evt.AggregateID(), evt.OldAssigneeID, evt.NewAssigneeID)

	// TODO:
	// - Notify new assignee
	// - Notify old assignee (if any)
	// - Update workload metrics

	return nil
}
