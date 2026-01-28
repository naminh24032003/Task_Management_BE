package event

import "time"

// DomainEvent is the base interface for all domain events
type DomainEvent interface {
	EventType() string
	OccurredOn() time.Time
	AggregateID() string
}
