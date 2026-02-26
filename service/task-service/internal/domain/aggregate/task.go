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
	// Aggregate Root Identity
	ID       string
	TenantID string

	// Core Fields
	Title       string
	Description string

	// Workflow
	Status   valueobject.TaskStatus
	Priority valueobject.TaskPriority

	// People
	AssigneeIDs []string
	WatcherIDs  []string
	CreatorID   string

	// Organization
	ProjectID    string
	SpaceID      string
	ParentTaskID string

	// Timestamps
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DueDate     *time.Time
	StartDate   *time.Time
	CompletedAt *time.Time

	// Time Tracking
	TimeEstimateMinutes int32
	TimeTrackedMinutes  int32

	// Metadata
	Tags          []string
	DependencyIDs []string
	OrderIndex    int32
	CustomFields  map[string]string

	// Entities
	Comments []*entity.Comment

	// Domain Events (unpublished)
	domainEvents []event.DomainEvent
}

// NewTask creates a new task aggregate (ClickUp-style)
func NewTask(id, tenantID, title, creatorID, projectID, spaceID string) (*Task, error) {
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
		ID:            id,
		TenantID:      tenantID,
		Title:         title,
		CreatorID:     creatorID,
		ProjectID:     projectID,
		SpaceID:       spaceID,
		Status:        valueobject.TaskStatusOpen,
		Priority:      valueobject.TaskPriorityNormal,
		CreatedAt:     now,
		UpdatedAt:     now,
		AssigneeIDs:   []string{},
		WatcherIDs:    []string{},
		Tags:          []string{},
		DependencyIDs: []string{},
		CustomFields:  make(map[string]string),
		Comments:      make([]*entity.Comment, 0),
		domainEvents:  make([]event.DomainEvent, 0),
	}

	// Raise domain event
	task.AddDomainEvent(event.NewTaskCreatedEvent(id, tenantID, title, projectID, creatorID, now))

	return task, nil
}

// UpdateStatus changes the task status
func (t *Task) UpdateStatus(newStatus valueobject.TaskStatus, actorID string) error {
	if !newStatus.IsValid() {
		return errors.New("invalid task status")
	}

	t.Status = newStatus
	t.UpdatedAt = time.Now()

	if newStatus == valueobject.TaskStatusComplete || newStatus == valueobject.TaskStatusClosed {
		now := time.Now()
		t.CompletedAt = &now
		t.AddDomainEvent(event.NewTaskCompletedEvent(t.ID, t.TenantID, actorID, now))
	}

	// Raise generic updated event or specific status changed event if needed
	return nil
}

// UpdatePriority changes the task priority
func (t *Task) UpdatePriority(newPriority valueobject.TaskPriority) error {
	if !newPriority.IsValid() {
		return errors.New("invalid task priority")
	}

	t.Priority = newPriority
	t.UpdatedAt = time.Now()
	return nil
}

// Assign assigns the task to users
func (t *Task) Assign(assigneeIDs []string, actorID string) {
	oldAssignees := t.AssigneeIDs
	t.AssigneeIDs = assigneeIDs
	t.UpdatedAt = time.Now()

	// Raise domain event for each new assignee or bulk
	if len(assigneeIDs) > 0 {
		// Simplified: just taking the first one for the specific event if needed,
		// but better to have a TaskAssigned event that supports multiple or individual
		for _, newID := range assigneeIDs {
			// Find if it's a new assignment
			isNew := true
			for _, oldID := range oldAssignees {
				if oldID == newID {
					isNew = false
					break
				}
			}
			if isNew {
				t.AddDomainEvent(event.NewTaskAssignedEvent(t.ID, t.TenantID, "", newID, actorID, t.Title, t.ProjectID, time.Now()))
			}
		}
	}
}

// UpdateFields updates editable task fields (partial update – nil means skip)
func (t *Task) UpdateFields(title, description, dueDate, startDate, parentTaskID *string, timeEstimate *int32, tags []string, customFields map[string]string) {
	if title != nil {
		t.Title = *title
	}
	if description != nil {
		t.Description = *description
	}
	if timeEstimate != nil {
		t.TimeEstimateMinutes = *timeEstimate
	}
	if dueDate != nil {
		if *dueDate == "" {
			t.DueDate = nil
		} else if parsed, err := time.Parse(time.RFC3339, *dueDate); err == nil {
			t.DueDate = &parsed
		}
	}
	if startDate != nil {
		if *startDate == "" {
			t.StartDate = nil
		} else if parsed, err := time.Parse(time.RFC3339, *startDate); err == nil {
			t.StartDate = &parsed
		}
	}
	if parentTaskID != nil {
		t.ParentTaskID = *parentTaskID
	}
	if tags != nil {
		t.Tags = tags
	}
	for k, v := range customFields {
		if t.CustomFields == nil {
			t.CustomFields = make(map[string]string)
		}
		t.CustomFields[k] = v
	}
	t.UpdatedAt = time.Now()
}

// AddWatcher adds a watcher to the task
func (t *Task) AddWatcher(watcherID string) {
	for _, id := range t.WatcherIDs {
		if id == watcherID {
			return
		}
	}
	t.WatcherIDs = append(t.WatcherIDs, watcherID)
	t.UpdatedAt = time.Now()
}

// AddComment adds a comment to the task
func (t *Task) AddComment(comment *entity.Comment) {
	t.Comments = append(t.Comments, comment)
	t.UpdatedAt = time.Now()
}

// Domain Events Management
func (t *Task) AddDomainEvent(evt event.DomainEvent) {
	t.domainEvents = append(t.domainEvents, evt)
}

func (t *Task) DomainEvents() []event.DomainEvent {
	return t.domainEvents
}

func (t *Task) ClearDomainEvents() {
	t.domainEvents = make([]event.DomainEvent, 0)
}
