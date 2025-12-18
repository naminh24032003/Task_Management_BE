package valueobject

import (
	"errors"
	"regexp"
	"strings"
)

// Email represents a valid email address
type Email struct {
	value string
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// NewEmail creates a new Email value object with validation
func NewEmail(email string) (*Email, error) {
	email = strings.TrimSpace(strings.ToLower(email))

	if email == "" {
		return nil, errors.New("email cannot be empty")
	}

	if len(email) > 255 {
		return nil, errors.New("email too long (max 255 characters)")
	}

	if !emailRegex.MatchString(email) {
		return nil, errors.New("invalid email format")
	}

	return &Email{value: email}, nil
}

// Value returns the email string
func (e *Email) Value() string {
	return e.value
}

// String implements Stringer interface
func (e *Email) String() string {
	return e.value
}

// Equals checks if two emails are equal
func (e *Email) Equals(other *Email) bool {
	if other == nil {
		return false
	}
	return e.value == other.value
}
