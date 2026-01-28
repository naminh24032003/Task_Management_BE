package notification

import (
	"context"
)

// Rule defines the interface for notification rules
type Rule interface {
	// Name returns the rule name
	Name() string

	// Match checks if the rule matches the given event
	Match(ctx context.Context, eventType string, eventData map[string]interface{}) bool

	// Apply applies the rule and returns notification details
	Apply(ctx context.Context, eventType string, eventData map[string]interface{}) (*RuleResult, error)
}

// RuleResult contains the result of applying a rule
type RuleResult struct {
	Recipients []Recipient
	Title      string
	Body       string
	Channel    Channel
	Priority   Priority
	Metadata   map[string]interface{}
}

// Recipient represents a notification recipient
type Recipient struct {
	UserID   string
	Channels Channels
}

// TaskCreatedRule handles notifications for task creation events
type TaskCreatedRule struct{}

func NewTaskCreatedRule() *TaskCreatedRule {
	return &TaskCreatedRule{}
}

func (r *TaskCreatedRule) Name() string {
	return "task_created_rule"
}

func (r *TaskCreatedRule) Match(ctx context.Context, eventType string, eventData map[string]interface{}) bool {
	return eventType == "task.created"
}

func (r *TaskCreatedRule) Apply(ctx context.Context, eventType string, eventData map[string]interface{}) (*RuleResult, error) {
	title := getStringValue(eventData, "title", "New Task")
	projectID := getStringValue(eventData, "project_id", "")
	creatorID := getStringValue(eventData, "creator_id", "")
	taskID := getStringValue(eventData, "aggregate_id", "")

	// For task created, notify project members (simplified - in real case, fetch from user service)
	recipients := []Recipient{}

	// Add creator as recipient for confirmation
	if creatorID != "" {
		recipients = append(recipients, Recipient{
			UserID:   creatorID,
			Channels: Channels{ChannelInApp},
		})
	}

	return &RuleResult{
		Recipients: recipients,
		Title:      "Task Created",
		Body:       "Task '" + title + "' has been created",
		Channel:    ChannelInApp,
		Priority:   PriorityNormal,
		Metadata: map[string]interface{}{
			"task_id":    taskID,
			"project_id": projectID,
			"action":     "task_created",
		},
	}, nil
}

// TaskAssignedRule handles notifications for task assignment events
type TaskAssignedRule struct{}

func NewTaskAssignedRule() *TaskAssignedRule {
	return &TaskAssignedRule{}
}

func (r *TaskAssignedRule) Name() string {
	return "task_assigned_rule"
}

func (r *TaskAssignedRule) Match(ctx context.Context, eventType string, eventData map[string]interface{}) bool {
	return eventType == "task.assigned"
}

func (r *TaskAssignedRule) Apply(ctx context.Context, eventType string, eventData map[string]interface{}) (*RuleResult, error) {
	taskTitle := getStringValue(eventData, "task_title", "Task")
	newAssigneeID := getStringValue(eventData, "new_assignee_id", "")
	oldAssigneeID := getStringValue(eventData, "old_assignee_id", "")
	assignedBy := getStringValue(eventData, "assigned_by", "")
	taskID := getStringValue(eventData, "aggregate_id", "")
	projectID := getStringValue(eventData, "project_id", "")

	recipients := []Recipient{}

	// Notify new assignee with high priority
	if newAssigneeID != "" {
		recipients = append(recipients, Recipient{
			UserID:   newAssigneeID,
			Channels: Channels{ChannelInApp, ChannelEmail, ChannelPush},
		})
	}

	// Notify old assignee about reassignment
	if oldAssigneeID != "" && oldAssigneeID != newAssigneeID {
		recipients = append(recipients, Recipient{
			UserID:   oldAssigneeID,
			Channels: Channels{ChannelInApp},
		})
	}

	return &RuleResult{
		Recipients: recipients,
		Title:      "Task Assigned",
		Body:       "You have been assigned to task '" + taskTitle + "'",
		Channel:    ChannelInApp,
		Priority:   PriorityHigh,
		Metadata: map[string]interface{}{
			"task_id":         taskID,
			"project_id":      projectID,
			"assigned_by":     assignedBy,
			"old_assignee_id": oldAssigneeID,
			"action":          "task_assigned",
		},
	}, nil
}

// TaskCompletedRule handles notifications for task completion events
type TaskCompletedRule struct{}

func NewTaskCompletedRule() *TaskCompletedRule {
	return &TaskCompletedRule{}
}

func (r *TaskCompletedRule) Name() string {
	return "task_completed_rule"
}

func (r *TaskCompletedRule) Match(ctx context.Context, eventType string, eventData map[string]interface{}) bool {
	return eventType == "task.completed"
}

func (r *TaskCompletedRule) Apply(ctx context.Context, eventType string, eventData map[string]interface{}) (*RuleResult, error) {
	taskTitle := getStringValue(eventData, "task_title", "Task")
	completedBy := getStringValue(eventData, "completed_by", "")
	taskID := getStringValue(eventData, "aggregate_id", "")
	projectID := getStringValue(eventData, "project_id", "")

	recipients := []Recipient{}

	// Notify the person who completed the task
	if completedBy != "" {
		recipients = append(recipients, Recipient{
			UserID:   completedBy,
			Channels: Channels{ChannelInApp},
		})
	}

	return &RuleResult{
		Recipients: recipients,
		Title:      "Task Completed",
		Body:       "Task '" + taskTitle + "' has been marked as complete",
		Channel:    ChannelInApp,
		Priority:   PriorityNormal,
		Metadata: map[string]interface{}{
			"task_id":      taskID,
			"project_id":   projectID,
			"completed_by": completedBy,
			"action":       "task_completed",
		},
	}, nil
}

// UserMentionedRule handles notifications for user mention events
type UserMentionedRule struct{}

func NewUserMentionedRule() *UserMentionedRule {
	return &UserMentionedRule{}
}

func (r *UserMentionedRule) Name() string {
	return "user_mentioned_rule"
}

func (r *UserMentionedRule) Match(ctx context.Context, eventType string, eventData map[string]interface{}) bool {
	return eventType == "user.mentioned"
}

func (r *UserMentionedRule) Apply(ctx context.Context, eventType string, eventData map[string]interface{}) (*RuleResult, error) {
	taskTitle := getStringValue(eventData, "task_title", "Task")
	mentionedBy := getStringValue(eventData, "mentioned_by", "")
	taskID := getStringValue(eventData, "aggregate_id", "")
	projectID := getStringValue(eventData, "project_id", "")
	commentText := getStringValue(eventData, "comment_text", "")

	// Get mentioned users
	mentionedUsers := getStringSlice(eventData, "mentioned_users")

	recipients := []Recipient{}
	for _, userID := range mentionedUsers {
		if userID != "" && userID != mentionedBy {
			recipients = append(recipients, Recipient{
				UserID:   userID,
				Channels: Channels{ChannelInApp, ChannelEmail, ChannelPush},
			})
		}
	}

	return &RuleResult{
		Recipients: recipients,
		Title:      "You were mentioned",
		Body:       "You were mentioned in task '" + taskTitle + "'",
		Channel:    ChannelInApp,
		Priority:   PriorityHigh,
		Metadata: map[string]interface{}{
			"task_id":      taskID,
			"project_id":   projectID,
			"mentioned_by": mentionedBy,
			"comment_text": commentText,
			"action":       "user_mentioned",
		},
	}, nil
}

// Helper functions
func getStringValue(data map[string]interface{}, key, defaultValue string) string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultValue
}

func getStringSlice(data map[string]interface{}, key string) []string {
	if val, ok := data[key]; ok {
		if slice, ok := val.([]interface{}); ok {
			result := make([]string, 0, len(slice))
			for _, item := range slice {
				if str, ok := item.(string); ok {
					result = append(result, str)
				}
			}
			return result
		}
		if slice, ok := val.([]string); ok {
			return slice
		}
	}
	return []string{}
}
