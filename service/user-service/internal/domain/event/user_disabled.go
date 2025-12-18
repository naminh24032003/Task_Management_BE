package event

import "time"

// UserDisabledEvent raised when a user is disabled
type UserDisabledEvent struct {
	eventType   string
	occurredOn  time.Time
	aggregateID string
}

// NewUserDisabledEvent creates a new UserDisabledEvent
func NewUserDisabledEvent(userID string, occurredOn time.Time) *UserDisabledEvent {
	return &UserDisabledEvent{
		eventType:   "user.disabled",
		occurredOn:  occurredOn,
		aggregateID: userID,
	}
}

func (e *UserDisabledEvent) EventType() string {
	return e.eventType
}

func (e *UserDisabledEvent) OccurredOn() time.Time {
	return e.occurredOn
}

func (e *UserDisabledEvent) AggregateID() string {
	return e.aggregateID
}
