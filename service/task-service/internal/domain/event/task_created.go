package event

import "time"

// DomainEvent is the base interface for all domain events
type DomainEvent interface {
	EventType() string
	OccurredOn() time.Time
	AggregateID() string
}

// TaskCreatedEvent raised when a new task is created
type TaskCreatedEvent struct {
	eventType   string
	occurredOn  time.Time
	aggregateID string
	Title       string
	ProjectID   string
}

// NewTaskCreatedEvent creates a new TaskCreatedEvent
func NewTaskCreatedEvent(taskID, title, projectID string, occurredOn time.Time) *TaskCreatedEvent {
	return &TaskCreatedEvent{
		eventType:   "task.created",
		occurredOn:  occurredOn,
		aggregateID: taskID,
		Title:       title,
		ProjectID:   projectID,
	}
}

func (e *TaskCreatedEvent) EventType() string {
	return e.eventType
}

func (e *TaskCreatedEvent) OccurredOn() time.Time {
	return e.occurredOn
}

func (e *TaskCreatedEvent) AggregateID() string {
	return e.aggregateID
}
