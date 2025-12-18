package valueobject

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"unicode"
)

// Password represents an encrypted password
type Password struct {
	hash string // 🔥 ALWAYS stored as hash, never plaintext
}

// NewPassword creates a password from plaintext (hashes it)
func NewPassword(plaintext string) (*Password, error) {
	if err := ValidatePasswordStrength(plaintext); err != nil {
		return nil, err
	}

	hash := hashPassword(plaintext)
	return &Password{hash: hash}, nil
}

// NewPasswordFromHash creates a password from an existing hash
func NewPasswordFromHash(hash string) *Password {
	return &Password{hash: hash}
}

// Hash returns the password hash
func (p *Password) Hash() string {
	return p.hash
}

// VerifyPassword checks if plaintext matches the hash
func (p *Password) VerifyPassword(plaintext string) bool {
	return p.hash == hashPassword(plaintext)
}

// ValidatePasswordStrength checks password requirements
func ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	if len(password) > 128 {
		return errors.New("password too long (max 128 characters)")
	}

	var (
		hasUpper   bool
		hasLower   bool
		hasNumber  bool
		hasSpecial bool
	)

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	if !hasUpper {
		return errors.New("password must contain at least one uppercase letter")
	}
	if !hasLower {
		return errors.New("password must contain at least one lowercase letter")
	}
	if !hasNumber {
		return errors.New("password must contain at least one number")
	}
	if !hasSpecial {
		return errors.New("password must contain at least one special character")
	}

	return nil
}

// hashPassword creates a SHA-256 hash (use bcrypt in production)
func hashPassword(plaintext string) string {
	// 🔥 NOTE: Use bcrypt in production!
	// This is simplified for example
	hash := sha256.Sum256([]byte(plaintext))
	return hex.EncodeToString(hash[:])
}
