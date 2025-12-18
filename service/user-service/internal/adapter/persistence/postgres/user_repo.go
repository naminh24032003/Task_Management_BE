package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"

	"user-service/internal/domain/aggregate"
	"user-service/internal/domain/entity"
	"user-service/internal/domain/valueobject"
)

// UserRepository implements repository.UserRepository for PostgreSQL
type UserRepository struct {
	db *sql.DB
}

// NewUserRepository creates a new PostgreSQL user repository
func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create saves a new user
func (r *UserRepository) Create(ctx context.Context, user *aggregate.User) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Insert user
	query := `
		INSERT INTO users (id, email, password_hash, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err = tx.ExecContext(ctx, query,
		user.ID,
		user.Email.Value(),
		user.Password.Hash(),
		string(user.Status),
		user.CreatedAt,
		user.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert user: %w", err)
	}

	// Insert profile if exists
	if user.Profile != nil {
		profileQuery := `
			INSERT INTO profiles (user_id, first_name, last_name, phone_number, avatar, bio, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`
		_, err = tx.ExecContext(ctx, profileQuery,
			user.Profile.UserID,
			user.Profile.FirstName,
			user.Profile.LastName,
			user.Profile.PhoneNumber,
			user.Profile.Avatar,
			user.Profile.Bio,
			user.Profile.CreatedAt,
			user.Profile.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert profile: %w", err)
		}
	}

	return tx.Commit()
}

// FindByID finds a user by ID
func (r *UserRepository) FindByID(ctx context.Context, id string) (*aggregate.User, error) {
	query := `
		SELECT u.id, u.email, u.password_hash, u.status, u.created_at, u.updated_at,
		       p.first_name, p.last_name, p.phone_number, p.avatar, p.bio, p.created_at, p.updated_at
		FROM users u
		LEFT JOIN profiles p ON u.id = p.user_id
		WHERE u.id = $1
	`

	var (
		userID, email, passwordHash, status           string
		createdAt, updatedAt                          time.Time
		firstName, lastName, phoneNumber, avatar, bio sql.NullString
		profileCreatedAt, profileUpdatedAt            sql.NullTime
	)

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&userID, &email, &passwordHash, &status, &createdAt, &updatedAt,
		&firstName, &lastName, &phoneNumber, &avatar, &bio, &profileCreatedAt, &profileUpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}

	return r.mapToAggregate(
		userID, email, passwordHash, status, createdAt, updatedAt,
		firstName, lastName, phoneNumber, avatar, bio, profileCreatedAt, profileUpdatedAt,
	)
}

// FindByEmail finds a user by email
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*aggregate.User, error) {
	query := `
		SELECT u.id, u.email, u.password_hash, u.status, u.created_at, u.updated_at,
		       p.first_name, p.last_name, p.phone_number, p.avatar, p.bio, p.created_at, p.updated_at
		FROM users u
		LEFT JOIN profiles p ON u.id = p.user_id
		WHERE u.email = $1
	`

	var (
		userID, userEmail, passwordHash, status       string
		createdAt, updatedAt                          time.Time
		firstName, lastName, phoneNumber, avatar, bio sql.NullString
		profileCreatedAt, profileUpdatedAt            sql.NullTime
	)

	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&userID, &userEmail, &passwordHash, &status, &createdAt, &updatedAt,
		&firstName, &lastName, &phoneNumber, &avatar, &bio, &profileCreatedAt, &profileUpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}

	return r.mapToAggregate(
		userID, userEmail, passwordHash, status, createdAt, updatedAt,
		firstName, lastName, phoneNumber, avatar, bio, profileCreatedAt, profileUpdatedAt,
	)
}

// Update updates an existing user
func (r *UserRepository) Update(ctx context.Context, user *aggregate.User) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Update user
	query := `
		UPDATE users
		SET email = $1, password_hash = $2, status = $3, updated_at = $4
		WHERE id = $5
	`
	_, err = tx.ExecContext(ctx, query,
		user.Email.Value(),
		user.Password.Hash(),
		string(user.Status),
		user.UpdatedAt,
		user.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	// Update profile if exists
	if user.Profile != nil {
		profileQuery := `
			UPDATE profiles
			SET first_name = $1, last_name = $2, phone_number = $3, avatar = $4, bio = $5, updated_at = $6
			WHERE user_id = $7
		`
		_, err = tx.ExecContext(ctx, profileQuery,
			user.Profile.FirstName,
			user.Profile.LastName,
			user.Profile.PhoneNumber,
			user.Profile.Avatar,
			user.Profile.Bio,
			user.Profile.UpdatedAt,
			user.Profile.UserID,
		)
		if err != nil {
			return fmt.Errorf("failed to update profile: %w", err)
		}
	}

	return tx.Commit()
}

// Delete soft deletes a user
func (r *UserRepository) Delete(ctx context.Context, id string) error {
	query := `UPDATE users SET status = 'disabled', updated_at = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, time.Now(), id)
	return err
}

// List returns a paginated list of users
func (r *UserRepository) List(ctx context.Context, offset, limit int) ([]*aggregate.User, error) {
	query := `
		SELECT u.id, u.email, u.password_hash, u.status, u.created_at, u.updated_at,
		       p.first_name, p.last_name, p.phone_number, p.avatar, p.bio, p.created_at, p.updated_at
		FROM users u
		LEFT JOIN profiles p ON u.id = p.user_id
		ORDER BY u.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*aggregate.User
	for rows.Next() {
		var (
			userID, email, passwordHash, status           string
			createdAt, updatedAt                          time.Time
			firstName, lastName, phoneNumber, avatar, bio sql.NullString
			profileCreatedAt, profileUpdatedAt            sql.NullTime
		)

		err := rows.Scan(
			&userID, &email, &passwordHash, &status, &createdAt, &updatedAt,
			&firstName, &lastName, &phoneNumber, &avatar, &bio, &profileCreatedAt, &profileUpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		user, err := r.mapToAggregate(
			userID, email, passwordHash, status, createdAt, updatedAt,
			firstName, lastName, phoneNumber, avatar, bio, profileCreatedAt, profileUpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		users = append(users, user)
	}

	return users, rows.Err()
}

// Helper: map database rows to aggregate
func (r *UserRepository) mapToAggregate(
	userID, email, passwordHash, status string,
	createdAt, updatedAt time.Time,
	firstName, lastName, phoneNumber, avatar, bio sql.NullString,
	profileCreatedAt, profileUpdatedAt sql.NullTime,
) (*aggregate.User, error) {
	// Reconstruct value objects
	emailVO, err := valueobject.NewEmail(email)
	if err != nil {
		return nil, err
	}

	passwordVO := valueobject.NewPasswordFromHash(passwordHash)

	// Create user aggregate
	user, err := aggregate.NewUser(userID, emailVO, passwordVO)
	if err != nil {
		return nil, err
	}

	user.Status = aggregate.UserStatus(status)
	user.CreatedAt = createdAt
	user.UpdatedAt = updatedAt

	// Reconstruct profile if exists
	if firstName.Valid {
		profile := &entity.Profile{
			UserID:      userID,
			FirstName:   firstName.String,
			LastName:    lastName.String,
			PhoneNumber: phoneNumber.String,
			Avatar:      avatar.String,
			Bio:         bio.String,
			CreatedAt:   profileCreatedAt.Time,
			UpdatedAt:   profileUpdatedAt.Time,
		}
		user.Profile = profile
	}

	return user, nil
}
