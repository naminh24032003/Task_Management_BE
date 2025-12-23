package grpc

import (
	"context"

	taskv1 "task-service/api/task/v1"
)

// TaskService implements the gRPC TaskService
type TaskService struct {
	taskv1.UnimplementedTaskServiceServer
}

// NewTaskService creates a new TaskService
func NewTaskService() *TaskService {
	return &TaskService{}
}

// Hello returns a greeting message - test gRPC
func (s *TaskService) Hello(ctx context.Context, req *taskv1.HelloRequest) (*taskv1.HelloResponse, error) {
	name := req.GetName()
	if name == "" {
		name = "World"
	}
	return &taskv1.HelloResponse{
		Message: "Hello from Task Service! Greeting from: " + name,
	}, nil
}
