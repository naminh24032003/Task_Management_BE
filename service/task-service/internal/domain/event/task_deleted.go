package event

import "time"

// TaskDeletedEvent raised when a task is deleted
type TaskDeletedEvent struct {
	Type       string    `json:"event_type"`
	OccurredAt time.Time `json:"occurred_at"`
	TaskID     string    `json:"aggregate_id"`
	TenantID   string    `json:"tenant_id"`
}

// NewTaskDeletedEvent creates a new TaskDeletedEvent
func NewTaskDeletedEvent(taskID, tenantID string) *TaskDeletedEvent {
	return &TaskDeletedEvent{
		Type:       "task.deleted",
		OccurredAt: time.Now(),
		TaskID:     taskID,
		TenantID:   tenantID,
	}
}

func (e *TaskDeletedEvent) EventType() string {
	return e.Type
}

func (e *TaskDeletedEvent) OccurredOn() time.Time {
	return e.OccurredAt
}

func (e *TaskDeletedEvent) AggregateID() string {
	return e.TaskID
}

func (e *TaskDeletedEvent) EventName() string {
	return "TaskDeleted"
}
