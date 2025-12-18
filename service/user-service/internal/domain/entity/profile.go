package entity

import "time"

// Profile represents user profile information (Entity)
type Profile struct {
	UserID      string
	FirstName   string
	LastName    string
	PhoneNumber string
	Avatar      string
	Bio         string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// NewProfile creates a new profile
func NewProfile(userID, firstName, lastName string) *Profile {
	now := time.Now()
	return &Profile{
		UserID:    userID,
		FirstName: firstName,
		LastName:  lastName,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// FullName returns the full name
func (p *Profile) FullName() string {
	return p.FirstName + " " + p.LastName
}

// UpdateProfile updates profile information
func (p *Profile) UpdateProfile(firstName, lastName, phoneNumber, bio string) {
	p.FirstName = firstName
	p.LastName = lastName
	p.PhoneNumber = phoneNumber
	p.Bio = bio
	p.UpdatedAt = time.Now()
}

// SetAvatar sets the avatar URL
func (p *Profile) SetAvatar(avatarURL string) {
	p.Avatar = avatarURL
	p.UpdatedAt = time.Now()
}
