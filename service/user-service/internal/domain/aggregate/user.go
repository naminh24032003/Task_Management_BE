package aggregate

import (
	"errors"
	"time"

	"user-service/internal/domain/entity"
	"user-service/internal/domain/event"
	"user-service/internal/domain/valueobject"
)

// UserStatus represents user account status
type UserStatus string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusDisabled UserStatus = "disabled"
	UserStatusPending  UserStatus = "pending"
)

// User is the aggregate root for user bounded context
type User struct {
	// Aggregate Root
	ID        string
	Email     *valueobject.Email
	Password  *valueobject.Password
	Status    UserStatus
	CreatedAt time.Time
	UpdatedAt time.Time

	// Entities
	Profile *entity.Profile

	// Domain Events (unpublished)
	domainEvents []event.DomainEvent
}

// NewUser creates a new user aggregate
func NewUser(id string, email *valueobject.Email, password *valueobject.Password) (*User, error) {
	if id == "" {
		return nil, errors.New("user ID cannot be empty")
	}
	if email == nil {
		return nil, errors.New("email cannot be nil")
	}
	if password == nil {
		return nil, errors.New("password cannot be nil")
	}

	now := time.Now()
	user := &User{
		ID:           id,
		Email:        email,
		Password:     password,
		Status:       UserStatusPending,
		CreatedAt:    now,
		UpdatedAt:    now,
		domainEvents: make([]event.DomainEvent, 0),
	}

	// Raise domain event
	user.addDomainEvent(event.NewUserCreatedEvent(id, email.Value(), now))

	return user, nil
}

// Activate activates the user account
func (u *User) Activate() error {
	if u.Status == UserStatusActive {
		return errors.New("user already active")
	}

	u.Status = UserStatusActive
	u.UpdatedAt = time.Now()
	return nil
}

// Disable disables the user account
func (u *User) Disable() error {
	if u.Status == UserStatusDisabled {
		return errors.New("user already disabled")
	}

	u.Status = UserStatusDisabled
	u.UpdatedAt = time.Now()

	// Raise domain event
	u.addDomainEvent(event.NewUserDisabledEvent(u.ID, time.Now()))

	return nil
}

// ChangePassword changes the user's password
func (u *User) ChangePassword(oldPassword, newPassword string) error {
	// Verify old password
	if !u.Password.VerifyPassword(oldPassword) {
		return errors.New("invalid current password")
	}

	// Create new password
	newPass, err := valueobject.NewPassword(newPassword)
	if err != nil {
		return err
	}

	u.Password = newPass
	u.UpdatedAt = time.Now()
	return nil
}

// VerifyPassword checks if password is correct
func (u *User) VerifyPassword(password string) bool {
	return u.Password.VerifyPassword(password)
}

// SetProfile sets the user profile
func (u *User) SetProfile(profile *entity.Profile) {
	u.Profile = profile
	u.UpdatedAt = time.Now()
}

// IsActive checks if user is active
func (u *User) IsActive() bool {
	return u.Status == UserStatusActive
}

// Domain Events Management
func (u *User) addDomainEvent(event event.DomainEvent) {
	u.domainEvents = append(u.domainEvents, event)
}

// DomainEvents returns all unpublished domain events
func (u *User) DomainEvents() []event.DomainEvent {
	return u.domainEvents
}

// ClearDomainEvents clears all domain events (after publishing)
func (u *User) ClearDomainEvents() {
	u.domainEvents = make([]event.DomainEvent, 0)
}
