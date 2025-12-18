package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"

	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/valueobject"
)

// TaskRepository implements repository.TaskRepository for PostgreSQL
type TaskRepository struct {
	db *sql.DB
}

// NewTaskRepository creates a new PostgreSQL task repository
func NewTaskRepository(db *sql.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

// Create saves a new task
func (r *TaskRepository) Create(ctx context.Context, task *aggregate.Task) error {
	query := `
		INSERT INTO tasks (id, title, description, status, priority, assignee_id, project_id, due_date, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.ExecContext(ctx, query,
		task.ID,
		task.Title,
		task.Description,
		task.Status.String(),
		task.Priority.String(),
		task.AssigneeID,
		task.ProjectID,
		task.DueDate,
		task.CreatedAt,
		task.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert task: %w", err)
	}

	return nil
}

// FindByID finds a task by ID
func (r *TaskRepository) FindByID(ctx context.Context, id string) (*aggregate.Task, error) {
	query := `
		SELECT id, title, description, status, priority, assignee_id, project_id, due_date, created_at, updated_at
		FROM tasks
		WHERE id = $1
	`

	var (
		taskID, title, description, status, priority, projectID string
		assigneeID                                              sql.NullString
		dueDate                                                 sql.NullTime
		createdAt, updatedAt                                    time.Time
	)

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&taskID, &title, &description, &status, &priority, &assigneeID, &projectID, &dueDate, &createdAt, &updatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("task not found")
	}
	if err != nil {
		return nil, err
	}

	return r.mapToAggregate(taskID, title, description, status, priority, assigneeID, projectID, dueDate, createdAt, updatedAt)
}

// Update updates an existing task
func (r *TaskRepository) Update(ctx context.Context, task *aggregate.Task) error {
	query := `
		UPDATE tasks
		SET title = $1, description = $2, status = $3, priority = $4, assignee_id = $5, due_date = $6, updated_at = $7
		WHERE id = $8
	`
	_, err := r.db.ExecContext(ctx, query,
		task.Title,
		task.Description,
		task.Status.String(),
		task.Priority.String(),
		task.AssigneeID,
		task.DueDate,
		task.UpdatedAt,
		task.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update task: %w", err)
	}

	return nil
}

// Delete deletes a task
func (r *TaskRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM tasks WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// List returns a paginated list of tasks
func (r *TaskRepository) List(ctx context.Context, offset, limit int) ([]*aggregate.Task, error) {
	query := `
		SELECT id, title, description, status, priority, assignee_id, project_id, due_date, created_at, updated_at
		FROM tasks
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	return r.queryTasks(ctx, query, limit, offset)
}

// FindByProjectID finds tasks by project ID
func (r *TaskRepository) FindByProjectID(ctx context.Context, projectID string, offset, limit int) ([]*aggregate.Task, error) {
	query := `
		SELECT id, title, description, status, priority, assignee_id, project_id, due_date, created_at, updated_at
		FROM tasks
		WHERE project_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	return r.queryTasks(ctx, query, projectID, limit, offset)
}

// FindByAssigneeID finds tasks by assignee ID
func (r *TaskRepository) FindByAssigneeID(ctx context.Context, assigneeID string, offset, limit int) ([]*aggregate.Task, error) {
	query := `
		SELECT id, title, description, status, priority, assignee_id, project_id, due_date, created_at, updated_at
		FROM tasks
		WHERE assignee_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	return r.queryTasks(ctx, query, assigneeID, limit, offset)
}

// FindByStatus finds tasks by status
func (r *TaskRepository) FindByStatus(ctx context.Context, status string, offset, limit int) ([]*aggregate.Task, error) {
	query := `
		SELECT id, title, description, status, priority, assignee_id, project_id, due_date, created_at, updated_at
		FROM tasks
		WHERE status = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	return r.queryTasks(ctx, query, status, limit, offset)
}

func (r *TaskRepository) queryTasks(ctx context.Context, query string, args ...interface{}) ([]*aggregate.Task, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*aggregate.Task
	for rows.Next() {
		var (
			taskID, title, description, status, priority, projectID string
			assigneeID                                              sql.NullString
			dueDate                                                 sql.NullTime
			createdAt, updatedAt                                    time.Time
		)

		err := rows.Scan(
			&taskID, &title, &description, &status, &priority, &assigneeID, &projectID, &dueDate, &createdAt, &updatedAt,
		)
		if err != nil {
			return nil, err
		}

		task, err := r.mapToAggregate(taskID, title, description, status, priority, assigneeID, projectID, dueDate, createdAt, updatedAt)
		if err != nil {
			return nil, err
		}

		tasks = append(tasks, task)
	}

	return tasks, rows.Err()
}

func (r *TaskRepository) mapToAggregate(
	taskID, title, description, status, priority string,
	assigneeID sql.NullString,
	projectID string,
	dueDate sql.NullTime,
	createdAt, updatedAt time.Time,
) (*aggregate.Task, error) {
	var dueDatePtr *time.Time
	if dueDate.Valid {
		dueDatePtr = &dueDate.Time
	}

	task, err := aggregate.NewTask(taskID, title, description, projectID, valueobject.ParsePriority(priority), dueDatePtr)
	if err != nil {
		return nil, err
	}

	task.Status = valueobject.TaskStatus(status)
	task.CreatedAt = createdAt
	task.UpdatedAt = updatedAt

	if assigneeID.Valid {
		task.AssigneeID = assigneeID.String
	}

	return task, nil
}
