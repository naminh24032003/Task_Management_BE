package event

import "time"

// TaskAssignedEvent raised when a task is assigned to a user
type TaskAssignedEvent struct {
	Type          string    `json:"event_type"`
	OccurredAt    time.Time `json:"occurred_at"`
	TaskID        string    `json:"aggregate_id"`
	OldAssigneeID string    `json:"old_assignee_id"`
	NewAssigneeID string    `json:"new_assignee_id"`
}

// NewTaskAssignedEvent creates a new TaskAssignedEvent
func NewTaskAssignedEvent(taskID, oldAssigneeID, newAssigneeID string, occurredOn time.Time) *TaskAssignedEvent {
	return &TaskAssignedEvent{
		Type:          "task.assigned",
		OccurredAt:    occurredOn,
		TaskID:        taskID,
		OldAssigneeID: oldAssigneeID,
		NewAssigneeID: newAssigneeID,
	}
}

func (e *TaskAssignedEvent) EventType() string {
	return e.Type
}

func (e *TaskAssignedEvent) OccurredOn() time.Time {
	return e.OccurredAt
}

func (e *TaskAssignedEvent) AggregateID() string {
	return e.TaskID
}
