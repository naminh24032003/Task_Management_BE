package event

import "time"

// TaskCreatedEvent represents an event when a task is created
type TaskCreatedEvent struct {
	Type       string    `json:"event_type"`
	OccurredAt time.Time `json:"occurred_at"`
	TaskID     string    `json:"aggregate_id"`
	Title      string    `json:"title"`
	ProjectID  string    `json:"project_id"`
	CreatorID  string    `json:"creator_id"`
}

func (e TaskCreatedEvent) EventType() string    { return e.Type }
func (e TaskCreatedEvent) OccurredOn() time.Time { return e.OccurredAt }
func (e TaskCreatedEvent) AggregateID() string   { return e.TaskID }

// TaskAssignedEvent represents an event when a task is assigned to a user
type TaskAssignedEvent struct {
	Type          string    `json:"event_type"`
	OccurredAt    time.Time `json:"occurred_at"`
	TaskID        string    `json:"aggregate_id"`
	TaskTitle     string    `json:"task_title"`
	OldAssigneeID string    `json:"old_assignee_id"`
	NewAssigneeID string    `json:"new_assignee_id"`
	AssignedBy    string    `json:"assigned_by"`
	ProjectID     string    `json:"project_id"`
}

func (e TaskAssignedEvent) EventType() string    { return e.Type }
func (e TaskAssignedEvent) OccurredOn() time.Time { return e.OccurredAt }
func (e TaskAssignedEvent) AggregateID() string   { return e.TaskID }

// TaskCompletedEvent represents an event when a task is completed
type TaskCompletedEvent struct {
	Type        string    `json:"event_type"`
	OccurredAt  time.Time `json:"occurred_at"`
	TaskID      string    `json:"aggregate_id"`
	TaskTitle   string    `json:"task_title"`
	CompletedBy string    `json:"completed_by"`
	ProjectID   string    `json:"project_id"`
}

func (e TaskCompletedEvent) EventType() string    { return e.Type }
func (e TaskCompletedEvent) OccurredOn() time.Time { return e.OccurredAt }
func (e TaskCompletedEvent) AggregateID() string   { return e.TaskID }

// UserMentionedEvent represents an event when a user is mentioned
type UserMentionedEvent struct {
	Type           string    `json:"event_type"`
	OccurredAt     time.Time `json:"occurred_at"`
	TaskID         string    `json:"aggregate_id"`
	TaskTitle      string    `json:"task_title"`
	MentionedUsers []string  `json:"mentioned_users"`
	MentionedBy    string    `json:"mentioned_by"`
	CommentID      string    `json:"comment_id"`
	CommentText    string    `json:"comment_text"`
	ProjectID      string    `json:"project_id"`
}

func (e UserMentionedEvent) EventType() string    { return e.Type }
func (e UserMentionedEvent) OccurredOn() time.Time { return e.OccurredAt }
func (e UserMentionedEvent) AggregateID() string   { return e.TaskID }

// Event type constants
const (
	TaskCreatedEventType    = "task.created"
	TaskAssignedEventType   = "task.assigned"
	TaskCompletedEventType  = "task.completed"
	UserMentionedEventType  = "user.mentioned"
)
