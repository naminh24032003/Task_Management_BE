package event

import "time"

// DomainEvent is the base interface for all domain events
type DomainEvent interface {
	EventType() string
	OccurredOn() time.Time
	AggregateID() string
}

// baseEvent contains common fields for all events
type baseEvent struct {
	eventType   string
	occurredOn  time.Time
	aggregateID string
}

func (e *baseEvent) EventType() string {
	return e.eventType
}

func (e *baseEvent) OccurredOn() time.Time {
	return e.occurredOn
}

func (e *baseEvent) AggregateID() string {
	return e.aggregateID
}

// UserCreatedEvent raised when a new user is created
type UserCreatedEvent struct {
	baseEvent
	Email string
}

// NewUserCreatedEvent creates a new UserCreatedEvent
func NewUserCreatedEvent(userID, email string, occurredOn time.Time) *UserCreatedEvent {
	return &UserCreatedEvent{
		baseEvent: baseEvent{
			eventType:   "user.created",
			occurredOn:  occurredOn,
			aggregateID: userID,
		},
		Email: email,
	}
}
