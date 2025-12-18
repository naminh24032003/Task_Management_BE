package entity

import "time"

// Comment represents a comment on a task (Entity)
type Comment struct {
	ID        string
	TaskID    string
	AuthorID  string
	Content   string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// NewComment creates a new comment
func NewComment(id, taskID, authorID, content string) *Comment {
	now := time.Now()
	return &Comment{
		ID:        id,
		TaskID:    taskID,
		AuthorID:  authorID,
		Content:   content,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// UpdateContent updates the comment content
func (c *Comment) UpdateContent(content string) {
	c.Content = content
	c.UpdatedAt = time.Now()
}
