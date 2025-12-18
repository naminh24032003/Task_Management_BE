package aggregate

import (
	"errors"
	"time"

	"task-service/internal/domain/entity"
	"task-service/internal/domain/event"
	"task-service/internal/domain/valueobject"
)

// Task is the aggregate root for task bounded context
type Task struct {
	// Aggregate Root
	ID          string
	Title       string
	Description string
	Status      valueobject.TaskStatus
	Priority    valueobject.Priority
	AssigneeID  string
	ProjectID   string
	DueDate     *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time

	// Entities
	Comments []*entity.Comment

	// Domain Events (unpublished)
	domainEvents []event.DomainEvent
}

// NewTask creates a new task aggregate
func NewTask(id, title, description, projectID string, priority valueobject.Priority, dueDate *time.Time) (*Task, error) {
	if id == "" {
		return nil, errors.New("task ID cannot be empty")
	}
	if title == "" {
		return nil, errors.New("title cannot be empty")
	}
	if projectID == "" {
		return nil, errors.New("project ID cannot be empty")
	}

	now := time.Now()
	task := &Task{
		ID:           id,
		Title:        title,
		Description:  description,
		Status:       valueobject.TaskStatusTodo,
		Priority:     priority,
		ProjectID:    projectID,
		DueDate:      dueDate,
		CreatedAt:    now,
		UpdatedAt:    now,
		Comments:     make([]*entity.Comment, 0),
		domainEvents: make([]event.DomainEvent, 0),
	}

	// Raise domain event
	task.addDomainEvent(event.NewTaskCreatedEvent(id, title, projectID, now))

	return task, nil
}

// Assign assigns the task to a user
func (t *Task) Assign(assigneeID string) error {
	if assigneeID == "" {
		return errors.New("assignee ID cannot be empty")
	}

	oldAssigneeID := t.AssigneeID
	t.AssigneeID = assigneeID
	t.UpdatedAt = time.Now()

	// Raise domain event
	t.addDomainEvent(event.NewTaskAssignedEvent(t.ID, oldAssigneeID, assigneeID, time.Now()))

	return nil
}

// Complete marks the task as completed
func (t *Task) Complete() error {
	if t.Status == valueobject.TaskStatusDone {
		return errors.New("task already completed")
	}

	t.Status = valueobject.TaskStatusDone
	t.UpdatedAt = time.Now()

	// Raise domain event
	t.addDomainEvent(event.NewTaskCompletedEvent(t.ID, time.Now()))

	return nil
}

// StartProgress moves task to in progress
func (t *Task) StartProgress() error {
	if t.Status != valueobject.TaskStatusTodo {
		return errors.New("task can only be started from todo status")
	}

	t.Status = valueobject.TaskStatusInProgress
	t.UpdatedAt = time.Now()
	return nil
}

// UpdatePriority updates task priority
func (t *Task) UpdatePriority(priority valueobject.Priority) {
	t.Priority = priority
	t.UpdatedAt = time.Now()
}

// AddComment adds a comment to the task
func (t *Task) AddComment(comment *entity.Comment) {
	t.Comments = append(t.Comments, comment)
	t.UpdatedAt = time.Now()
}

// IsOverdue checks if task is past due date
func (t *Task) IsOverdue() bool {
	if t.DueDate == nil {
		return false
	}
	return time.Now().After(*t.DueDate) && t.Status != valueobject.TaskStatusDone
}

// Domain Events Management
func (t *Task) addDomainEvent(evt event.DomainEvent) {
	t.domainEvents = append(t.domainEvents, evt)
}

// DomainEvents returns all unpublished domain events
func (t *Task) DomainEvents() []event.DomainEvent {
	return t.domainEvents
}

// ClearDomainEvents clears all domain events (after publishing)
func (t *Task) ClearDomainEvents() {
	t.domainEvents = make([]event.DomainEvent, 0)
}
