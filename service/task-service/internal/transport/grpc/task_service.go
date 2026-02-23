package grpc

import (
	"context"
	"time"

	"github.com/go-kratos/kratos/v2/log"

	taskv1 "task-service/api/task/v1"
	"task-service/internal/application/command"
	"task-service/internal/application/handler"
	"task-service/internal/application/query"
	"task-service/internal/domain/aggregate"
	"task-service/internal/domain/valueobject"
)

// TaskService implements the gRPC TaskService
type TaskService struct {
	taskv1.UnimplementedTaskServiceServer

	commandHandler *handler.CommandHandlerOutbox
	queryHandler   *handler.QueryHandler
	logger         *log.Helper
}

// NewTaskService creates a new TaskService
func NewTaskService(commandHandler *handler.CommandHandlerOutbox, queryHandler *handler.QueryHandler, logger log.Logger) *TaskService {
	return &TaskService{
		commandHandler: commandHandler,
		queryHandler:   queryHandler,
		logger:         log.NewHelper(log.With(logger, "module", "grpc/task-service")),
	}
}

// Hello implements the Hello gRPC method
func (s *TaskService) Hello(ctx context.Context, req *taskv1.HelloRequest) (*taskv1.HelloResponse, error) {
	return &taskv1.HelloResponse{Message: "Hello, " + req.GetName() + "!"}, nil
}

// CreateTask handles task creation
func (s *TaskService) CreateTask(ctx context.Context, req *taskv1.CreateTaskRequest) (*taskv1.CreateTaskResponse, error) {
	dueDate, _ := parseTime(req.GetDueDate())
	startDate, _ := parseTime(req.GetStartDate())

	cmd := command.NewCreateTaskCommand(
		req.GetTenantId(),
		req.GetTitle(),
		req.GetDescription(),
		int32(req.GetPriority()),
		req.GetProjectId(),
		req.GetSpaceId(),
		req.GetCreatorId(),
		req.GetAssigneeIds(),
		dueDate,
		startDate,
		req.GetTimeEstimateMinutes(),
		req.GetTags(),
		req.GetParentTaskId(),
		req.GetCustomFields(),
	)

	id, err := s.commandHandler.HandleCreateTask(ctx, cmd)
	if err != nil {
		return nil, err
	}

	task, _ := s.queryHandler.HandleGetTask(ctx, &query.GetTaskQuery{ID: id, TenantID: req.GetTenantId()})

	return &taskv1.CreateTaskResponse{
		Task:    s.toProto(task),
		Success: true,
		Message: "Task created successfully",
	}, nil
}

// GetTask handles task retrieval
func (s *TaskService) GetTask(ctx context.Context, req *taskv1.GetTaskRequest) (*taskv1.GetTaskResponse, error) {
	task, err := s.queryHandler.HandleGetTask(ctx, &query.GetTaskQuery{ID: req.GetId(), TenantID: req.GetTenantId()})
	if err != nil {
		return nil, err
	}
	return &taskv1.GetTaskResponse{Task: s.toProto(task)}, nil
}

// ListTasks handles task listing with filters (supports both offset and cursor pagination)
func (s *TaskService) ListTasks(ctx context.Context, req *taskv1.ListTasksRequest) (*taskv1.ListTasksResponse, error) {
	q := &query.ListTasksQuery{
		TenantID:    req.GetTenantId(),
		Page:        req.GetPage(),
		PageSize:    req.GetPageSize(),
		ProjectID:   req.GetProjectId(),
		SpaceID:     req.GetSpaceId(),
		AssigneeIDs: req.GetAssigneeIds(),
		SearchQuery: req.GetSearchQuery(),
		SortBy:      req.GetSortBy(),
		SortDesc:    req.GetSortDesc(),
		Cursor:      req.GetCursor(),
		Limit:       req.GetLimit(),
	}

	for _, st := range req.GetStatuses() {
		q.Statuses = append(q.Statuses, valueobject.TaskStatus(st))
	}

	result, err := s.queryHandler.HandleListTasks(ctx, q)
	if err != nil {
		return nil, err
	}

	var protoTasks []*taskv1.Task
	for _, t := range result.Tasks {
		protoTasks = append(protoTasks, s.toProto(t))
	}

	return &taskv1.ListTasksResponse{
		Tasks:      protoTasks,
		Total:      int32(result.Total),
		Page:       req.GetPage(),
		PageSize:   req.GetPageSize(),
		NextCursor: result.NextCursor,
		HasMore:    result.HasMore,
	}, nil
}

func (s *TaskService) UpdateTaskStatus(ctx context.Context, req *taskv1.UpdateTaskStatusRequest) (*taskv1.UpdateTaskResponse, error) {
	err := s.commandHandler.HandleUpdateTaskStatus(ctx, &command.UpdateTaskStatusCommand{
		ID:        req.GetId(),
		TenantID:  req.GetTenantId(),
		Status:    int32(req.GetStatus()),
		UpdatedBy: req.GetUpdatedBy(),
	})
	if err != nil {
		return nil, err
	}

	task, _ := s.queryHandler.HandleGetTask(ctx, &query.GetTaskQuery{ID: req.GetId(), TenantID: req.GetTenantId()})
	return &taskv1.UpdateTaskResponse{Task: s.toProto(task), Success: true}, nil
}

func (s *TaskService) AssignTask(ctx context.Context, req *taskv1.AssignTaskRequest) (*taskv1.UpdateTaskResponse, error) {
	err := s.commandHandler.HandleAssignTask(ctx, &command.AssignTaskCommand{
		ID:          req.GetId(),
		TenantID:    req.GetTenantId(),
		AssigneeIDs: req.GetAssigneeIds(),
		AssignedBy:  req.GetAssignedBy(),
	})
	if err != nil {
		return nil, err
	}

	task, _ := s.queryHandler.HandleGetTask(ctx, &query.GetTaskQuery{ID: req.GetId(), TenantID: req.GetTenantId()})
	return &taskv1.UpdateTaskResponse{Task: s.toProto(task), Success: true}, nil
}

func (s *TaskService) DeleteTask(ctx context.Context, req *taskv1.DeleteTaskRequest) (*taskv1.DeleteTaskResponse, error) {
	err := s.commandHandler.HandleDeleteTask(ctx, &command.DeleteTaskCommand{
		ID:       req.GetId(),
		TenantID: req.GetTenantId(),
	})
	if err != nil {
		return &taskv1.DeleteTaskResponse{Success: false, Message: err.Error()}, nil
	}
	return &taskv1.DeleteTaskResponse{Success: true, Message: "Task deleted"}, nil
}

// Helpers & Mappers

func (s *TaskService) toProto(t *aggregate.Task) *taskv1.Task {
	if t == nil {
		return nil
	}
	return &taskv1.Task{
		Id:                  t.ID,
		TenantId:            t.TenantID,
		Title:               t.Title,
		Description:         t.Description,
		Status:              taskv1.TaskStatus(t.Status),
		Priority:            taskv1.TaskPriority(t.Priority),
		AssigneeIds:         t.AssigneeIDs,
		WatcherIds:          t.WatcherIDs,
		CreatorId:           t.CreatorID,
		ProjectId:           t.ProjectID,
		SpaceId:             t.SpaceID,
		ParentTaskId:        t.ParentTaskID,
		CreatedAt:           t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:           t.UpdatedAt.Format(time.RFC3339),
		DueDate:             formatTime(t.DueDate),
		StartDate:           formatTime(t.StartDate),
		CompletedAt:         formatTime(t.CompletedAt),
		TimeEstimateMinutes: t.TimeEstimateMinutes,
		TimeTrackedMinutes:  t.TimeTrackedMinutes,
		Tags:                t.Tags,
		DependencyIds:       t.DependencyIDs,
		OrderIndex:          t.OrderIndex,
		CustomFields:        t.CustomFields,
	}
}

func parseTime(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func formatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(time.RFC3339)
}
