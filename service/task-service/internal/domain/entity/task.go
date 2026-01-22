package entity

import (
	"task-service/internal/domain/valueobject"
	"time"
)

type Task struct {
	ID          string
	TenantID    string
	Title       string
	Description string

	Status   valueobject.TaskStatus
	Priority valueobject.TaskPriority

	AssigneeIDs []string
	WatcherIDs  []string
	CreatorID   string

	ProjectID    string
	SpaceID      string
	ParentTaskID string

	CreatedAt   time.Time
	UpdatedAt   time.Time
	DueDate     *time.Time
	StartDate   *time.Time
	CompletedAt *time.Time

	TimeEstimateMinutes int32
	TimeTrackedMinutes  int32

	Tags          []string
	DependencyIDs []string
	OrderIndex    int32
	CustomFields  map[string]string
}

// NewTask creates a new task with default values
func NewTask(tenantID, title, creatorID, projectID, spaceID string) *Task {
	now := time.Now()
	return &Task{
		TenantID:      tenantID,
		Title:         title,
		CreatorID:     creatorID,
		ProjectID:     projectID,
		SpaceID:       spaceID,
		Status:        valueobject.TaskStatusOpen,
		Priority:      valueobject.TaskPriorityNormal,
		CreatedAt:     now,
		UpdatedAt:     now,
		Tags:          []string{},
		AssigneeIDs:   []string{},
		WatcherIDs:    []string{},
		DependencyIDs: []string{},
		CustomFields:  make(map[string]string),
	}
}

func (t *Task) UpdateStatus(newStatus valueobject.TaskStatus) {
	t.Status = newStatus
	t.UpdatedAt = time.Now()
	if newStatus == valueobject.TaskStatusComplete || newStatus == valueobject.TaskStatusClosed {
		now := time.Now()
		t.CompletedAt = &now
	}
}

func (t *Task) UpdatePriority(newPriority valueobject.TaskPriority) {
	t.Priority = newPriority
	t.UpdatedAt = time.Now()
}
