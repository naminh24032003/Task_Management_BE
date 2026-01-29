package event

import "time"

// TaskCompletedEvent raised when a task is completed
type TaskCompletedEvent struct {
	Type       string    `json:"event_type"`
	OccurredAt time.Time `json:"occurred_at"`
	TaskID     string    `json:"aggregate_id"`
}

// NewTaskCompletedEvent creates a new TaskCompletedEvent
func NewTaskCompletedEvent(taskID string, occurredOn time.Time) *TaskCompletedEvent {
	return &TaskCompletedEvent{
		Type:       "task.completed",
		OccurredAt: occurredOn,
		TaskID:     taskID,
	}
}

func (e *TaskCompletedEvent) EventType() string {
	return e.Type
}

func (e *TaskCompletedEvent) OccurredOn() time.Time {
	return e.OccurredAt
}

func (e *TaskCompletedEvent) AggregateID() string {
	return e.TaskID
}

func (e *TaskCompletedEvent) EventName() string {
	return "TaskCompleted"
}
