package valueobject

import "strings"

type TaskPriority int32

const (
	TaskPriorityUnspecified TaskPriority = 0
	TaskPriorityLow         TaskPriority = 1
	TaskPriorityNormal      TaskPriority = 2
	TaskPriorityHigh        TaskPriority = 3
	TaskPriorityUrgent      TaskPriority = 4
)

func (p TaskPriority) String() string {
	switch p {
	case TaskPriorityLow:
		return "LOW"
	case TaskPriorityNormal:
		return "NORMAL"
	case TaskPriorityHigh:
		return "HIGH"
	case TaskPriorityUrgent:
		return "URGENT"
	default:
		return "NORMAL"
	}
}

func (p TaskPriority) IsValid() bool {
	return p >= TaskPriorityLow && p <= TaskPriorityUrgent
}

func (p TaskPriority) Weight() int {
	return int(p)
}

func ParseTaskPriority(s string) TaskPriority {
	switch strings.ToUpper(s) {
	case "LOW":
		return TaskPriorityLow
	case "NORMAL":
		return TaskPriorityNormal
	case "HIGH":
		return TaskPriorityHigh
	case "URGENT":
		return TaskPriorityUrgent
	default:
		return TaskPriorityNormal
	}
}
