package event

import "time"

// TaskCompletedEvent raised when a task is completed
type TaskCompletedEvent struct {
	eventType   string
	occurredOn  time.Time
	aggregateID string
}

// NewTaskCompletedEvent creates a new TaskCompletedEvent
func NewTaskCompletedEvent(taskID string, occurredOn time.Time) *TaskCompletedEvent {
	return &TaskCompletedEvent{
		eventType:   "task.completed",
		occurredOn:  occurredOn,
		aggregateID: taskID,
	}
}

func (e *TaskCompletedEvent) EventType() string {
	return e.eventType
}

func (e *TaskCompletedEvent) OccurredOn() time.Time {
	return e.occurredOn
}

func (e *TaskCompletedEvent) AggregateID() string {
	return e.aggregateID
}
