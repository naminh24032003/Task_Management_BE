package event

import "time"

// TaskAssignedEvent raised when a task is assigned to a user
type TaskAssignedEvent struct {
	Type          string    `json:"event_type"`
	OccurredAt    time.Time `json:"occurred_at"`
	TaskID        string    `json:"aggregate_id"`
	TenantID      string    `json:"tenant_id"`
	OldAssigneeID string    `json:"old_assignee_id"`
	NewAssigneeID string    `json:"new_assignee_id"`
	AssignedBy    string    `json:"assigned_by"`
}

// NewTaskAssignedEvent creates a new TaskAssignedEvent
func NewTaskAssignedEvent(taskID, tenantID, oldAssigneeID, newAssigneeID, assignedBy string, occurredOn time.Time) *TaskAssignedEvent {
	return &TaskAssignedEvent{
		Type:          "task.assigned",
		OccurredAt:    occurredOn,
		TaskID:        taskID,
		TenantID:      tenantID,
		OldAssigneeID: oldAssigneeID,
		NewAssigneeID: newAssigneeID,
		AssignedBy:    assignedBy,
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

func (e *TaskAssignedEvent) EventName() string {
	return "TaskAssigned"
}
