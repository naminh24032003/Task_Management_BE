package event

import "time"

// TaskAssignedEvent raised when a task is assigned to a user
type TaskAssignedEvent struct {
	eventType     string
	occurredOn    time.Time
	aggregateID   string
	OldAssigneeID string
	NewAssigneeID string
}

// NewTaskAssignedEvent creates a new TaskAssignedEvent
func NewTaskAssignedEvent(taskID, oldAssigneeID, newAssigneeID string, occurredOn time.Time) *TaskAssignedEvent {
	return &TaskAssignedEvent{
		eventType:     "task.assigned",
		occurredOn:    occurredOn,
		aggregateID:   taskID,
		OldAssigneeID: oldAssigneeID,
		NewAssigneeID: newAssigneeID,
	}
}

func (e *TaskAssignedEvent) EventType() string {
	return e.eventType
}

func (e *TaskAssignedEvent) OccurredOn() time.Time {
	return e.occurredOn
}

func (e *TaskAssignedEvent) AggregateID() string {
	return e.aggregateID
}
