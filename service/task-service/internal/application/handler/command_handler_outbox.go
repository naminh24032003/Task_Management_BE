package handler

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"task-service/internal/application/command"
	"task-service/internal/application/port"
	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/event"
	"task-service/internal/domain/service"
	"task-service/internal/domain/valueobject"
	"task-service/internal/pkg/auth"
)

const (
	// Lock TTL for write operations on a single task
	taskLockTTL = 10 * time.Second
	// Idempotency window – duplicate requests within this window are deduplicated
	idempotencyTTL = 5 * time.Minute
	// Cache TTL for individual task objects
	taskCacheTTL = 10 * time.Minute
)

// CommandHandlerOutbox handles all write operations using Outbox Pattern
// Enhanced with Redis Lua-based distributed lock, idempotency, cache invalidation & atomic counters.
type CommandHandlerOutbox struct {
	unitOfWork    port.UnitOfWork
	taskFinder    port.TaskFinder
	domainService *service.TaskDomainService
	cache         port.TaskCache // nil-safe: all features degrade gracefully
}

// NewCommandHandlerOutbox creates a new command handler with outbox support
func NewCommandHandlerOutbox(
	unitOfWork port.UnitOfWork,
	taskFinder port.TaskFinder,
	domainService *service.TaskDomainService,
	cache port.TaskCache,
) *CommandHandlerOutbox {
	return &CommandHandlerOutbox{
		unitOfWork:    unitOfWork,
		taskFinder:    taskFinder,
		domainService: domainService,
		cache:         cache,
	}
}

// HandleCreateTask handles create task command with transactional outbox.
// Lua-atomic features: idempotency check → distributed lock → DB TX → cache warm → counters.
func (h *CommandHandlerOutbox) HandleCreateTask(ctx context.Context, cmd *command.CreateTaskCommand) (string, error) {
	// ── 1. Idempotency (Lua SETNX) ──────────────────────────
	idempotencyKey := fmt.Sprintf("create:%s:%s:%s", cmd.TenantID, cmd.ProjectID, cmd.Title)
	if h.cache != nil {
		if existing, ok, _ := h.cache.CheckIdempotency(ctx, idempotencyKey, idempotencyTTL); ok {
			return existing, nil // already processed → return cached taskID
		}
	}

	// ── 2. Validate ──────────────────────────────────────────
	if err := h.domainService.ValidateTaskCreation(ctx, cmd.Title, cmd.ProjectID); err != nil {
		return "", err
	}

	// ── 3. Build aggregate ──────────────────────────────────
	taskID := uuid.New().String()
	task, err := aggregate.NewTask(taskID, cmd.TenantID, cmd.Title, cmd.CreatorID, cmd.ProjectID, cmd.SpaceID)
	if err != nil {
		return "", fmt.Errorf("failed to create task: %w", err)
	}
	task.Description = cmd.Description
	task.Priority = valueobject.TaskPriority(cmd.Priority)
	task.DueDate = cmd.DueDate
	task.StartDate = cmd.StartDate
	task.TimeEstimateMinutes = cmd.TimeEstimate
	task.Tags = cmd.Tags
	task.ParentTaskID = cmd.ParentTaskID
	task.CustomFields = cmd.CustomFields
	task.AssigneeIDs = cmd.AssigneeIDs

	// ── 4. MongoDB transaction (task + outbox) ───────────────
	if err := h.unitOfWork.CreateTaskWithEvents(ctx, task); err != nil {
		return "", fmt.Errorf("failed to save task with events: %w", err)
	}

	// ── 5. Post-commit: cache warm + counters (best effort) ─
	if h.cache != nil {
		_ = h.cache.SetIdempotencyResult(ctx, idempotencyKey, taskID, idempotencyTTL)
		_ = h.cache.SetTask(ctx, cmd.TenantID, taskID, task, taskCacheTTL)
		_, _ = h.cache.IncrementProjectTaskCount(ctx, cmd.TenantID, cmd.ProjectID, 1)
		for _, uid := range cmd.AssigneeIDs {
			_, _ = h.cache.IncrementUserAssignedCount(ctx, cmd.TenantID, uid, 1)
		}
	}

	return taskID, nil
}

// HandleUpdateTaskStatus handles update task status command with transactional outbox.
// Lua-atomic: distributed lock (prevents concurrent status transitions on the same task) → DB TX → cache invalidation.
func (h *CommandHandlerOutbox) HandleUpdateTaskStatus(ctx context.Context, cmd *command.UpdateTaskStatusCommand) error {
	// ── 1. Distributed lock on the task (Lua SET NX PX) ────
	lockResource := fmt.Sprintf("task:%s:%s", cmd.TenantID, cmd.ID)
	var lockToken string
	if h.cache != nil {
		var err error
		lockToken, err = h.cache.AcquireLock(ctx, lockResource, taskLockTTL)
		if err != nil {
			return fmt.Errorf("failed to acquire lock: %w", err)
		}
		if lockToken == "" {
			return fmt.Errorf("task %s is being modified by another request", cmd.ID)
		}
		defer h.cache.ReleaseLock(ctx, lockResource, lockToken) //nolint:errcheck
	}

	// ── 2. Load & authorize ─────────────────────────────────
	task, err := h.taskFinder.FindByID(ctx, cmd.TenantID, cmd.ID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	identity := auth.GetIdentityFromContext(ctx)
	if err := h.domainService.AuthorizeUpdateTaskStatus(ctx, identity, task); err != nil {
		return err
	}

	actorID := ""
	if identity != nil {
		actorID = identity.UserID
	} else if cmd.UpdatedBy != "" {
		actorID = cmd.UpdatedBy
	}

	if err := task.UpdateStatus(valueobject.TaskStatus(cmd.Status), actorID); err != nil {
		return err
	}

	// ── 3. MongoDB transaction ──────────────────────────────
	if err := h.unitOfWork.UpdateTaskWithEvents(ctx, task); err != nil {
		return fmt.Errorf("failed to update task with events: %w", err)
	}

	// ── 4. Cache invalidation (Lua DEL) ─────────────────────
	if h.cache != nil {
		_ = h.cache.InvalidateTask(ctx, cmd.TenantID, cmd.ID)
	}

	return nil
}

// HandleAssignTask handles assign task command with transactional outbox.
// Lua-atomic: distributed lock → DB TX → cache invalidation → user counters (HINCRBY).
func (h *CommandHandlerOutbox) HandleAssignTask(ctx context.Context, cmd *command.AssignTaskCommand) error {
	// ── 1. Distributed lock ─────────────────────────────────
	lockResource := fmt.Sprintf("task:%s:%s", cmd.TenantID, cmd.ID)
	var lockToken string
	if h.cache != nil {
		var err error
		lockToken, err = h.cache.AcquireLock(ctx, lockResource, taskLockTTL)
		if err != nil {
			return fmt.Errorf("failed to acquire lock: %w", err)
		}
		if lockToken == "" {
			return fmt.Errorf("task %s is being modified by another request", cmd.ID)
		}
		defer h.cache.ReleaseLock(ctx, lockResource, lockToken) //nolint:errcheck
	}

	// ── 2. Load & authorize ─────────────────────────────────
	task, err := h.taskFinder.FindByID(ctx, cmd.TenantID, cmd.ID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	identity := auth.GetIdentityFromContext(ctx)
	if err := h.domainService.AuthorizeAssignTask(ctx, identity, task); err != nil {
		return err
	}

	actorID := ""
	if identity != nil {
		actorID = identity.UserID
	} else if cmd.AssignedBy != "" {
		actorID = cmd.AssignedBy
	}

	oldAssignees := task.AssigneeIDs
	task.Assign(cmd.AssigneeIDs, actorID)

	// ── 3. MongoDB transaction ──────────────────────────────
	if err := h.unitOfWork.UpdateTaskWithEvents(ctx, task); err != nil {
		return fmt.Errorf("failed to update task with events: %w", err)
	}

	// ── 4. Post-commit: cache + counters (best effort) ──────
	if h.cache != nil {
		_ = h.cache.InvalidateTask(ctx, cmd.TenantID, cmd.ID)

		// Decrement old assignees, increment new ones (Lua HINCRBY)
		for _, uid := range oldAssignees {
			_, _ = h.cache.IncrementUserAssignedCount(ctx, cmd.TenantID, uid, -1)
		}
		for _, uid := range cmd.AssigneeIDs {
			_, _ = h.cache.IncrementUserAssignedCount(ctx, cmd.TenantID, uid, 1)
		}
	}

	return nil
}

// HandleUpdateTask handles generic task field updates with transactional outbox.
func (h *CommandHandlerOutbox) HandleUpdateTask(ctx context.Context, cmd *command.UpdateTaskCommand) error {
	// ── 1. Distributed lock ─────────────────────────────────
	lockResource := fmt.Sprintf("task:%s:%s", cmd.TenantID, cmd.ID)
	var lockToken string
	if h.cache != nil {
		var err error
		lockToken, err = h.cache.AcquireLock(ctx, lockResource, taskLockTTL)
		if err != nil {
			return fmt.Errorf("failed to acquire lock: %w", err)
		}
		if lockToken == "" {
			return fmt.Errorf("task %s is being modified by another request", cmd.ID)
		}
		defer h.cache.ReleaseLock(ctx, lockResource, lockToken) //nolint:errcheck
	}

	// ── 2. Load task ────────────────────────────────────────
	task, err := h.taskFinder.FindByID(ctx, cmd.TenantID, cmd.ID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	// ── 3. Apply field updates ──────────────────────────────
	task.UpdateFields(cmd.Title, cmd.Description, cmd.DueDate, cmd.StartDate, cmd.ParentTaskID, cmd.TimeEstimate, cmd.Tags, cmd.CustomFields)

	// ── 4. MongoDB transaction ──────────────────────────────
	if err := h.unitOfWork.UpdateTaskWithEvents(ctx, task); err != nil {
		return fmt.Errorf("failed to update task with events: %w", err)
	}

	// ── 5. Cache invalidation ───────────────────────────────
	if h.cache != nil {
		_ = h.cache.InvalidateTask(ctx, cmd.TenantID, cmd.ID)
	}

	return nil
}

// HandleDeleteTask handles delete task command with transactional outbox.
// Lua-atomic: distributed lock → DB TX → cache invalidation → decrement counters.
func (h *CommandHandlerOutbox) HandleDeleteTask(ctx context.Context, cmd *command.DeleteTaskCommand) error {
	// ── 1. Distributed lock ─────────────────────────────────
	lockResource := fmt.Sprintf("task:%s:%s", cmd.TenantID, cmd.ID)
	var lockToken string
	if h.cache != nil {
		var err error
		lockToken, err = h.cache.AcquireLock(ctx, lockResource, taskLockTTL)
		if err != nil {
			return fmt.Errorf("failed to acquire lock: %w", err)
		}
		if lockToken == "" {
			return fmt.Errorf("task %s is being modified by another request", cmd.ID)
		}
		defer h.cache.ReleaseLock(ctx, lockResource, lockToken) //nolint:errcheck
	}

	// ── 2. Load & authorize ─────────────────────────────────
	task, err := h.taskFinder.FindByID(ctx, cmd.TenantID, cmd.ID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	identity := auth.GetIdentityFromContext(ctx)
	if err := h.domainService.AuthorizeDeleteTask(ctx, identity, task); err != nil {
		return err
	}

	actorID := ""
	if identity != nil {
		actorID = identity.UserID
	} else if cmd.DeletedBy != "" {
		actorID = cmd.DeletedBy
	}

	deleteEvent := event.NewTaskDeletedEvent(cmd.ID, cmd.TenantID, actorID)

	// ── 3. MongoDB transaction ──────────────────────────────
	if err := h.unitOfWork.DeleteTaskWithEvents(ctx, cmd.TenantID, cmd.ID, deleteEvent); err != nil {
		return fmt.Errorf("failed to delete task with events: %w", err)
	}

	// ── 4. Post-commit: cache invalidation + counter decrement
	if h.cache != nil {
		_ = h.cache.InvalidateTask(ctx, cmd.TenantID, cmd.ID)
		_, _ = h.cache.IncrementProjectTaskCount(ctx, cmd.TenantID, task.ProjectID, -1)
		for _, uid := range task.AssigneeIDs {
			_, _ = h.cache.IncrementUserAssignedCount(ctx, cmd.TenantID, uid, -1)
		}
	}

	return nil
}
