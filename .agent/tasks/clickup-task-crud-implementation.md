# ClickUp-Style Task Management CRUD API Implementation Plan

## 🎯 Objective
Implement full CRUD operations for task-service following ClickUp's task management model with Clean Architecture pattern.

## 📐 Architecture Principles
1. **Shared Proto**: All `.proto` files live in `packages/proto/task/v1/` and sync to service
2. **Clean Architecture**: Follow existing structure in `task-service/internal/`
3. **Event-Driven**: Publish Kafka events for all state changes
4. **ClickUp Model**: Match ClickUp's features and status workflow

## 📊 ClickUp Task Model

### Core Fields
- **ID**: Unique identifier (MongoDB ObjectID)
- **Title**: Task name (required)
- **Description**: Rich text description
- **Status**: Workflow status (see below)
- **Priority**: Urgent, High, Normal, Low
- **Assignees**: Array of user IDs
- **Watchers**: Array of user IDs watching the task  
- **Creator**: User ID who created the task
- **Project/List ID**: Parent container
- **Space ID**: Top-level container
- **Tenant ID**: Multi-tenancy support

### Status Workflow (ClickUp-style)
```
TO DO → IN PROGRESS → REVIEW → COMPLETE → CLOSED
```

Enum values:
- `OPEN` / `TO_DO` (default)
- `IN_PROGRESS`
- `BLOCKED`
- `REVIEW` / `READY_FOR_REVIEW`
- `COMPLETE` / `DONE`
- `CLOSED`
- `CANCELLED`

### Dates & Time
- **Created At**: Auto-generated
- **Updated At**: Auto-updated
- **Due Date**: Optional deadline
- **Start Date**: Optional start date
- **Completed At**: When marked complete
- **Time Estimate**: Estimated time in minutes
- **Time Tracked**: Actual time tracked in minutes

### Organization
- **Tags**: Array of tag strings
- **Custom Fields**: Map of custom field values
- **Parent Task ID**: For subtasks
- **Dependencies**: Array of task IDs this depends on
- **Order Index**: For sorting within list

### Collaboration Features (Future)
- **Comments**: Array of comment objects
- **Attachments**: Array of file references
- **Checklists**: Array of checklist items with completion status
- **Activity Log**: Audit trail of changes

## 🏗️ Implementation Structure

### 1. Proto Definition (`packages/proto/task/v1/task.proto`)

```protobuf
syntax = "proto3";

package task.v1;

// Enums
enum TaskStatus {
  TASK_STATUS_UNSPECIFIED = 0;
  TASK_STATUS_OPEN = 1;
  TASK_STATUS_IN_PROGRESS = 2;
  TASK_STATUS_BLOCKED = 3;
  TASK_STATUS_REVIEW = 4;
  TASK_STATUS_COMPLETE = 5;
  TASK_STATUS_CLOSED = 6;
  TASK_STATUS_CANCELLED = 7;
}

enum TaskPriority {
  TASK_PRIORITY_UNSPECIFIED = 0;
  TASK_PRIORITY_LOW = 1;
  TASK_PRIORITY_NORMAL = 2;
  TASK_PRIORITY_HIGH = 3;
  TASK_PRIORITY_URGENT = 4;
}

// Core Task Entity
message Task {
  string id = 1;
  string tenant_id = 2;
  string title = 3;
  string description = 4;
  
  TaskStatus status = 5;
  TaskPriority priority = 6;
  
  repeated string assignee_ids = 7;
  repeated string watcher_ids = 8;
  string creator_id = 9;
  
  string project_id = 10;
  string space_id = 11;
  string parent_task_id = 12;
  
  string created_at = 13;
  string updated_at = 14;
  string due_date = 15;
  string start_date = 16;
  string completed_at = 17;
  
  int32 time_estimate_minutes = 18;
  int32 time_tracked_minutes = 19;
  
  repeated string tags = 20;
  repeated string dependency_ids = 21;
  int32 order_index = 22;
  
  map<string, string> custom_fields = 23;
}

// CRUD Operations
service TaskService {
  // Create
  rpc CreateTask(CreateTaskRequest) returns (CreateTaskResponse);
  
  // Read
  rpc GetTask(GetTaskRequest) returns (GetTaskResponse);
  rpc ListTasks(ListTasksRequest) returns (ListTasksResponse);
  rpc GetTasksByProject(GetTasksByProjectRequest) returns (ListTasksResponse);
  
  // Update
  rpc UpdateTask(UpdateTaskRequest) returns (UpdateTaskResponse);
  rpc UpdateTaskStatus(UpdateTaskStatusRequest) returns (UpdateTaskResponse);
  rpc AssignTask(AssignTaskRequest) returns (UpdateTaskResponse);
  rpc UpdateTaskPriority(UpdateTaskPriorityRequest) returns (UpdateTaskResponse);
  
  // Delete
  rpc DeleteTask(DeleteTaskRequest) returns (DeleteTaskResponse);
  
  // Batch Operations
  rpc BulkUpdateStatus(BulkUpdateStatusRequest) returns (BulkUpdateStatusResponse);
  rpc BulkAssign(BulkAssignRequest) returns (BulkAssignResponse);
}
```

### 2. Domain Layer (`internal/domain/`)

#### Entity (`internal/domain/entity/task.go`)
```go
type Task struct {
    ID          string
    TenantID    string
    Title       string
    Description string
    
    Status      TaskStatus
    Priority    TaskPriority
    
    AssigneeIDs []string
    WatcherIDs  []string
    CreatorID   string
    
    ProjectID    string
    SpaceID      string
    ParentTaskID string
    
    CreatedAt   time.Time
    UpdatedAt   time.Time
    DueDate     *time.Time
    StartDate   *time.Time
    CompletedAt *time.Time
    
    TimeEstimateMinutes int32
    TimeTrackedMinutes  int32
    
    Tags           []string
    DependencyIDs  []string
    OrderIndex     int32
    CustomFields   map[string]string
}

// Business logic methods
func (t *Task) MarkInProgress() error
func (t *Task) MarkComplete() error
func (t *Task) AssignTo(userIDs []string) error
func (t *Task) UpdatePriority(priority TaskPriority) error
func (t *Task) CanTransitionTo(newStatus TaskStatus) bool
```

#### Value Objects (`internal/domain/valueobject/`)
- `task_status.go`: Status enum with validation
- `task_priority.go`: Priority enum with validation

#### Repository Interface (`internal/domain/repository/task_repository.go`)
```go
type TaskRepository interface {
    Create(ctx context.Context, task *entity.Task) error
    FindByID(ctx context.Context, id string) (*entity.Task, error)
    FindByProjectID(ctx context.Context, projectID string, filter TaskFilter) ([]*entity.Task, int64, error)
    Update(ctx context.Context, task *entity.Task) error
    Delete(ctx context.Context, id string) error
    BulkUpdateStatus(ctx context.Context, ids []string, status valueobject.TaskStatus) error
}
```

#### Domain Events (`internal/domain/event/`)
- `task_created.go`
- `task_updated.go`
- `task_status_changed.go`
- `task_assigned.go`
- `task_completed.go`
- `task_deleted.go`

### 3. Application Layer (`internal/application/`)

#### Commands (Write Operations)
- `create_task_command.go` / `create_task_handler.go`
- `update_task_command.go` / `update_task_handler.go`
- `update_task_status_command.go` / `update_task_status_handler.go`
- `assign_task_command.go` / `assign_task_handler.go`
- `delete_task_command.go` / `delete_task_handler.go`
- `bulk_update_status_command.go` / `bulk_update_status_handler.go`

#### Queries (Read Operations)
- `get_task_query.go` / `get_task_handler.go`
- `list_tasks_query.go` / `list_tasks_handler.go`
- `get_tasks_by_project_query.go` / `get_tasks_by_project_handler.go`

All handlers should:
1. Validate input
2. Execute domain logic
3. Persist changes
4. Publish domain events to Kafka

### 4. Adapter Layer (`internal/adapter/`)

#### Persistence (`internal/adapter/persistence/mongodb/`)
- `task_repository.go`: Implement TaskRepository interface
- `task_mapper.go`: Map between domain entity and MongoDB document

MongoDB Collection schema:
```go
type TaskDocument struct {
    ID          primitive.ObjectID `bson:"_id,omitempty"`
    TenantID    string            `bson:"tenant_id"`
    Title       string            `bson:"title"`
    Description string            `bson:"description"`
    Status      string            `bson:"status"`
    Priority    string            `bson:"priority"`
    
    AssigneeIDs []string `bson:"assignee_ids"`
    WatcherIDs  []string `bson:"watcher_ids"`
    CreatorID   string   `bson:"creator_id"`
    
    ProjectID    string `bson:"project_id"`
    SpaceID      string `bson:"space_id"`
    ParentTaskID string `bson:"parent_task_id,omitempty"`
    
    CreatedAt   time.Time  `bson:"created_at"`
    UpdatedAt   time.Time  `bson:"updated_at"`
    DueDate     *time.Time `bson:"due_date,omitempty"`
    StartDate   *time.Time `bson:"start_date,omitempty"`
    CompletedAt *time.Time `bson:"completed_at,omitempty"`
    
    TimeEstimateMinutes int32 `bson:"time_estimate_minutes"`
    TimeTrackedMinutes  int32 `bson:"time_tracked_minutes"`
    
    Tags           []string          `bson:"tags"`
    DependencyIDs  []string          `bson:"dependency_ids"`
    OrderIndex     int32             `bson:"order_index"`
    CustomFields   map[string]string `bson:"custom_fields,omitempty"`
}
```

Indexes:
```javascript
// Multi-tenant queries
db.tasks.createIndex({ "tenant_id": 1, "project_id": 1 })
db.tasks.createIndex({ "tenant_id": 1, "assignee_ids": 1 })
db.tasks.createIndex({ "tenant_id": 1, "status": 1 })

// Sorting and filtering
db.tasks.createIndex({ "tenant_id": 1, "project_id": 1, "order_index": 1 })
db.tasks.createIndex({ "tenant_id": 1, "due_date": 1 })
db.tasks.createIndex({ "tenant_id": 1, "created_at": -1 })

// Full-text search
db.tasks.createIndex({ "title": "text", "description": "text" })
```

#### Messaging (`internal/adapter/messaging/kafka/`)
- `task_event_publisher.go`: Publish domain events to Kafka topics
  - Topic: `tasks` (all task events)
  - Topic: `task-status-changes` (for analytics)

Event payload example:
```json
{
  "event_type": "task.created",
  "timestamp": "2026-01-23T00:00:00Z",
  "service": "task-service",
  "version": "1.0",
  "task_id": "65a1234567890abcdef12345",
  "tenant_id": "default",
  "project_id": "proj-123",
  "creator_id": "user-456",
  "title": "Implement authentication",
  "status": "OPEN",
  "priority": "HIGH"
}
```

### 5. Transport Layer (`internal/transport/grpc/`)

#### gRPC Handlers (`internal/transport/grpc/task_handler.go`)
```go
type TaskHandler struct {
    createTaskHandler       *application.CreateTaskHandler
    updateTaskHandler       *application.UpdateTaskHandler
    getTaskHandler          *application.GetTaskHandler
    listTasksHandler        *application.ListTasksHandler
    deleteTaskHandler       *application.DeleteTaskHandler
    // ... other handlers
}

// Implement all TaskService methods from proto
func (h *TaskHandler) CreateTask(ctx context.Context, req *taskv1.CreateTaskRequest) (*taskv1.CreateTaskResponse, error)
func (h *TaskHandler) GetTask(ctx context.Context, req *taskv1.GetTaskRequest) (*taskv1.GetTaskResponse, error)
// ... etc
```

### 6. BFF Integration

Update `bff-service` to call task-service via gRPC:

#### GraphQL Types (`service/bff-service/src/presentation/graphql/types/task.type.ts`)
```typescript
@ObjectType()
export class Task {
  @Field(() => ID)
  id: string;

  @Field()
  tenantId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description: string;

  @Field(() => TaskStatus)
  status: TaskStatus;

  @Field(() => TaskPriority)
  priority: TaskPriority;

  @Field(() => [String])
  assigneeIds: string[];
  
  // ... all other fields
}

@ObjectType()
export class TaskConnection {
  @Field(() => [Task])
  tasks: Task[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  pageSize: number;
}
```

#### GraphQL Resolvers (`service/bff-service/src/presentation/graphql/resolvers/task.resolver.ts`)
```typescript
@Resolver(() => Task)
export class TaskResolver {
  constructor(private readonly taskServiceClient: TaskServiceGrpcClient) {}

  @Mutation(() => Task)
  async createTask(@Args('input') input: CreateTaskInput): Promise<Task> {
    return this.taskServiceClient.createTask(input);
  }

  @Query(() => Task)
  async task(@Args('id') id: string): Promise<Task> {
    return this.taskServiceClient.getTask(id);
  }

  @Query(() => TaskConnection)
  async tasks(@Args('input') input: ListTasksInput): Promise<TaskConnection> {
    return this.taskServiceClient.listTasks(input);
  }
  
  // ... all other resolvers
}
```

## 🔄 Implementation Steps

### Phase 1: Proto & Code Generation
1. ✅ Update `packages/proto/task/v1/task.proto` with full ClickUp model
2. ✅ Generate Go code: `make proto-gen` in task-service
3. ✅ Generate TypeScript for BFF: `make proto-gen` in bff-service

### Phase 2: Domain Layer
4. ✅ Create Task entity with business logic
5. ✅ Create Value Objects (Status, Priority)
6. ✅ Define Repository interface
7. ✅ Create Domain Events

### Phase 3: Application Layer  
8. ✅ Implement Command handlers (Create, Update, Delete)
9. ✅ Implement Query handlers (Get, List)
10. ✅ Add validation logic

### Phase 4: Adapter Layer
11. ✅ Implement MongoDB repository
12. ✅ Create indexes for performance
13. ✅ Implement Kafka event publisher
14. ✅ Configure topics

### Phase 5: Transport Layer
15. ✅ Implement gRPC handlers
16. ✅ Add error handling and logging
17. ✅ Write integration tests

### Phase 6: BFF Integration
18. ✅ Create GraphQL types and inputs
19. ✅ Implement GraphQL resolvers
20. ✅ Connect to task-service gRPC client
21. ✅ Add to Kong ingress routes

### Phase 7: Testing & Deployment
22. ✅ Unit tests for domain logic
23. ✅ Integration tests for repositories
24. ✅ Contract tests for gRPC
25. ✅ E2E tests via GraphQL
26. ✅ Deploy to Minikube
27. ✅ Verify Kafka events

## 🎯 Success Criteria
- [ ] All CRUD operations working via GraphQL
- [ ] Task status workflow enforced
- [ ] Events published to Kafka for all changes
- [ ] Multi-tenancy working correctly
- [ ] Filtering and pagination working
- [ ] Performance: List 1000 tasks < 100ms
- [ ] All tests passing

## 📝 Notes
- Follow same patterns as user-service
- Proto files MUST be in `packages/proto/`
- Maintain Clean Architecture boundaries
- Event names follow pattern: `task.{action}`
- All mutations require tenant_id validation
