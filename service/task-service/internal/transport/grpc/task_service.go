package grpc

import (
	"context"
	"fmt"

	"github.com/go-kratos/kratos/v2/log"

	taskv1 "task-service/api/task/v1"
	"task-service/internal/domain/repository"
	"task-service/internal/pkg/auth"
)

// TaskService implements the gRPC TaskService
type TaskService struct {
	taskv1.UnimplementedTaskServiceServer

	repo   repository.TaskRepository
	logger *log.Helper
}

// NewTaskService creates a new TaskService
func NewTaskService(repo repository.TaskRepository, logger log.Logger) *TaskService {
	return &TaskService{
		repo:   repo,
		logger: log.NewHelper(log.With(logger, "module", "grpc/task-service")),
	}
}

// Hello returns a greeting message - test gRPC (Public endpoint)
func (s *TaskService) Hello(ctx context.Context, req *taskv1.HelloRequest) (*taskv1.HelloResponse, error) {
	name := req.GetName()
	if name == "" {
		name = "World"
	}

	// Demo: Check if user is authenticated (optional for public endpoint)
	identity := auth.GetIdentityFromContext(ctx)
	authInfo := "Anonymous"
	if identity.IsAuthenticated() {
		authInfo = fmt.Sprintf("User: %s (Tenant: %s, Roles: %v)",
			identity.UserID, identity.TenantID, identity.Roles)
	}

	s.logger.Infof("Hello request from: %s | Auth: %s", name, authInfo)

	return &taskv1.HelloResponse{
		Message: fmt.Sprintf("Hello from Task Service! Greeting: %s | Auth: %s", name, authInfo),
	}, nil
}

// ============================================
// Example: How to use auth in handlers
// ============================================

// CreateTask example (requires authentication)
// func (s *TaskService) CreateTask(ctx context.Context, req *taskv1.CreateTaskRequest) (*taskv1.CreateTaskResponse, error) {
// 	// Get authenticated user identity
// 	identity := auth.GetIdentityFromContext(ctx)
//
// 	// The middleware already verified auth, but you can access user info here
// 	s.logger.Infof("CreateTask by user: %s (tenant: %s)", identity.UserID, identity.TenantID)
//
// 	// Create task with owner = current user
// 	task := &domain.Task{
// 		Title:       req.Title,
// 		Description: req.Description,
// 		CreatedBy:   identity.UserID,
// 		TenantID:    identity.TenantID,
// 	}
//
// 	// Save to repository...
// 	return &taskv1.CreateTaskResponse{Task: task}, nil
// }

// DeleteTask example (requires admin role - enforced by middleware)
// func (s *TaskService) DeleteTask(ctx context.Context, req *taskv1.DeleteTaskRequest) (*taskv1.DeleteTaskResponse, error) {
// 	identity := auth.GetIdentityFromContext(ctx)
//
// 	// Middleware already verified admin role, but you can double-check or log
// 	s.logger.Infof("DeleteTask by admin: %s", identity.UserID)
//
// 	// Additional business logic check: only allow deleting tasks in same tenant
// 	task, err := s.repo.GetByID(ctx, req.TaskId)
// 	if err != nil {
// 		return nil, err
// 	}
//
// 	if task.TenantID != identity.TenantID {
// 		return nil, errors.Forbidden("PERMISSION_DENIED", "cannot delete task from another tenant")
// 	}
//
// 	// Delete task...
// 	return &taskv1.DeleteTaskResponse{Success: true}, nil
// }

// AssignTask example (requires manager or admin role)
// func (s *TaskService) AssignTask(ctx context.Context, req *taskv1.AssignTaskRequest) (*taskv1.AssignTaskResponse, error) {
// 	identity := auth.GetIdentityFromContext(ctx)
//
// 	// Middleware verified role, log the action
// 	s.logger.Infof("AssignTask by %s (roles: %v)", identity.UserID, identity.Roles)
//
// 	// Assign task to user...
// 	return &taskv1.AssignTaskResponse{}, nil
// }
