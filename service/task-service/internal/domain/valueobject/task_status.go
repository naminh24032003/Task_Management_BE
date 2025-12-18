package valueobject

// TaskStatus represents the status of a task
type TaskStatus string

const (
	TaskStatusTodo       TaskStatus = "todo"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusInReview   TaskStatus = "in_review"
	TaskStatusDone       TaskStatus = "done"
	TaskStatusCancelled  TaskStatus = "cancelled"
)

// IsValid checks if the status is valid
func (s TaskStatus) IsValid() bool {
	switch s {
	case TaskStatusTodo, TaskStatusInProgress, TaskStatusInReview, TaskStatusDone, TaskStatusCancelled:
		return true
	}
	return false
}

// String returns string representation
func (s TaskStatus) String() string {
	return string(s)
}

// CanTransitionTo checks if status can transition to another status
func (s TaskStatus) CanTransitionTo(target TaskStatus) bool {
	transitions := map[TaskStatus][]TaskStatus{
		TaskStatusTodo:       {TaskStatusInProgress, TaskStatusCancelled},
		TaskStatusInProgress: {TaskStatusInReview, TaskStatusTodo, TaskStatusCancelled},
		TaskStatusInReview:   {TaskStatusDone, TaskStatusInProgress, TaskStatusCancelled},
		TaskStatusDone:       {TaskStatusTodo}, // Can reopen
		TaskStatusCancelled:  {TaskStatusTodo}, // Can reopen
	}

	allowedTransitions, exists := transitions[s]
	if !exists {
		return false
	}

	for _, allowed := range allowedTransitions {
		if allowed == target {
			return true
		}
	}
	return false
}
