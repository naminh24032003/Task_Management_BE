package valueobject

import "strings"

type TaskStatus int32

const (
	TaskStatusUnspecified TaskStatus = 0
	TaskStatusOpen        TaskStatus = 1
	TaskStatusInProgress  TaskStatus = 2
	TaskStatusBlocked     TaskStatus = 3
	TaskStatusReview      TaskStatus = 4
	TaskStatusComplete    TaskStatus = 5
	TaskStatusClosed      TaskStatus = 6
	TaskStatusCancelled   TaskStatus = 7
)

func (s TaskStatus) String() string {
	switch s {
	case TaskStatusOpen:
		return "OPEN"
	case TaskStatusInProgress:
		return "IN_PROGRESS"
	case TaskStatusBlocked:
		return "BLOCKED"
	case TaskStatusReview:
		return "REVIEW"
	case TaskStatusComplete:
		return "COMPLETE"
	case TaskStatusClosed:
		return "CLOSED"
	case TaskStatusCancelled:
		return "CANCELLED"
	default:
		return "OPEN"
	}
}

func (s TaskStatus) IsValid() bool {
	return s >= TaskStatusOpen && s <= TaskStatusCancelled
}

func ParseTaskStatus(s string) TaskStatus {
	switch strings.ToUpper(s) {
	case "OPEN", "TO_DO":
		return TaskStatusOpen
	case "IN_PROGRESS":
		return TaskStatusInProgress
	case "BLOCKED":
		return TaskStatusBlocked
	case "REVIEW":
		return TaskStatusReview
	case "COMPLETE", "DONE":
		return TaskStatusComplete
	case "CLOSED":
		return TaskStatusClosed
	case "CANCELLED":
		return TaskStatusCancelled
	default:
		return TaskStatusOpen
	}
}
