package grpc

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"

	taskv1 "task-service/api/task/v1"
	"task-service/internal/domain/repository"
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

// Hello returns a greeting message - test gRPC
func (s *TaskService) Hello(ctx context.Context, req *taskv1.HelloRequest) (*taskv1.HelloResponse, error) {
	name := req.GetName()
	if name == "" {
		name = "World"
	}

	s.logger.Infof("Hello request received from: %s", name)

	return &taskv1.HelloResponse{
		Message: "Hello from Task Service! Greeting from: " + name + " (MongoDB connected)",
	}, nil
}
