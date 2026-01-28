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
	Type       string    `json:"event_type"`
	OccurredAt time.Time `json:"occurred_at"`
	TaskID     string    `json:"aggregate_id"`
	Title      string    `json:"title"`
	ProjectID  string    `json:"project_id"`
}

// NewTaskCreatedEvent creates a new TaskCreatedEvent
func NewTaskCreatedEvent(taskID, title, projectID string, occurredOn time.Time) *TaskCreatedEvent {
	return &TaskCreatedEvent{
		Type:       "task.created",
		OccurredAt: occurredOn,
		TaskID:     taskID,
		Title:      title,
		ProjectID:  projectID,
	}
}

func (e *TaskCreatedEvent) EventType() string {
	return e.Type
}

func (e *TaskCreatedEvent) OccurredOn() time.Time {
	return e.OccurredAt
}

func (e *TaskCreatedEvent) AggregateID() string {
	return e.TaskID
}
