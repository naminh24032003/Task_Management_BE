package template

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"
)

// Renderer handles template rendering for notifications
type Renderer struct {
	templates map[string]*template.Template
}

// NewRenderer creates a new template renderer
func NewRenderer() *Renderer {
	r := &Renderer{
		templates: make(map[string]*template.Template),
	}
	r.loadDefaultTemplates()
	return r
}

func (r *Renderer) loadDefaultTemplates() {
	// Task Created templates
	r.templates["task.created.title"] = mustParse("task.created.title", `Task Created`)
	r.templates["task.created.body"] = mustParse("task.created.body", `Task "{{.Title}}" has been created in project {{.ProjectID}}`)
	r.templates["task.created.email.subject"] = mustParse("task.created.email.subject", `[Task Created] {{.Title}}`)
	r.templates["task.created.email.body"] = mustParse("task.created.email.body", `
<html>
<body>
<h2>New Task Created</h2>
<p>A new task has been created:</p>
<ul>
<li><strong>Title:</strong> {{.Title}}</li>
<li><strong>Project:</strong> {{.ProjectID}}</li>
<li><strong>Created by:</strong> {{.CreatorID}}</li>
</ul>
<p><a href="{{.TaskURL}}">View Task</a></p>
</body>
</html>`)

	// Task Assigned templates
	r.templates["task.assigned.title"] = mustParse("task.assigned.title", `Task Assigned`)
	r.templates["task.assigned.body"] = mustParse("task.assigned.body", `You have been assigned to task "{{.TaskTitle}}"`)
	r.templates["task.assigned.email.subject"] = mustParse("task.assigned.email.subject", `[Task Assigned] {{.TaskTitle}}`)
	r.templates["task.assigned.email.body"] = mustParse("task.assigned.email.body", `
<html>
<body>
<h2>Task Assigned to You</h2>
<p>You have been assigned to the following task:</p>
<ul>
<li><strong>Task:</strong> {{.TaskTitle}}</li>
<li><strong>Assigned by:</strong> {{.AssignedBy}}</li>
<li><strong>Project:</strong> {{.ProjectID}}</li>
</ul>
<p><a href="{{.TaskURL}}">View Task</a></p>
</body>
</html>`)

	// Task Completed templates
	r.templates["task.completed.title"] = mustParse("task.completed.title", `Task Completed`)
	r.templates["task.completed.body"] = mustParse("task.completed.body", `Task "{{.TaskTitle}}" has been marked as complete`)
	r.templates["task.completed.email.subject"] = mustParse("task.completed.email.subject", `[Task Completed] {{.TaskTitle}}`)
	r.templates["task.completed.email.body"] = mustParse("task.completed.email.body", `
<html>
<body>
<h2>Task Completed</h2>
<p>The following task has been completed:</p>
<ul>
<li><strong>Task:</strong> {{.TaskTitle}}</li>
<li><strong>Completed by:</strong> {{.CompletedBy}}</li>
<li><strong>Project:</strong> {{.ProjectID}}</li>
</ul>
<p><a href="{{.TaskURL}}">View Task</a></p>
</body>
</html>`)

	// User Mentioned templates
	r.templates["user.mentioned.title"] = mustParse("user.mentioned.title", `You were mentioned`)
	r.templates["user.mentioned.body"] = mustParse("user.mentioned.body", `{{.MentionedBy}} mentioned you in task "{{.TaskTitle}}"`)
	r.templates["user.mentioned.email.subject"] = mustParse("user.mentioned.email.subject", `[Mention] {{.MentionedBy}} mentioned you`)
	r.templates["user.mentioned.email.body"] = mustParse("user.mentioned.email.body", `
<html>
<body>
<h2>You Were Mentioned</h2>
<p>{{.MentionedBy}} mentioned you in a comment:</p>
<blockquote>{{.CommentText}}</blockquote>
<ul>
<li><strong>Task:</strong> {{.TaskTitle}}</li>
<li><strong>Project:</strong> {{.ProjectID}}</li>
</ul>
<p><a href="{{.TaskURL}}">View Comment</a></p>
</body>
</html>`)
}

func mustParse(name, text string) *template.Template {
	t, err := template.New(name).Parse(text)
	if err != nil {
		panic(fmt.Sprintf("failed to parse template %s: %v", name, err))
	}
	return t
}

// RenderData contains data for rendering templates
type RenderData struct {
	// Task fields
	Title       string
	TaskTitle   string
	TaskID      string
	TaskURL     string
	ProjectID   string

	// User fields
	CreatorID   string
	AssignedBy  string
	CompletedBy string
	MentionedBy string

	// Comment fields
	CommentText string

	// Generic fields
	Metadata    map[string]interface{}
}

// Render renders a template with the given data
func (r *Renderer) Render(templateName string, data RenderData) (string, error) {
	tmpl, ok := r.templates[templateName]
	if !ok {
		return "", fmt.Errorf("template not found: %s", templateName)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to render template %s: %w", templateName, err)
	}

	return strings.TrimSpace(buf.String()), nil
}

// RenderTitle renders the title template for an event type
func (r *Renderer) RenderTitle(eventType string, data RenderData) (string, error) {
	templateName := eventType + ".title"
	return r.Render(templateName, data)
}

// RenderBody renders the body template for an event type
func (r *Renderer) RenderBody(eventType string, data RenderData) (string, error) {
	templateName := eventType + ".body"
	return r.Render(templateName, data)
}

// RenderEmailSubject renders the email subject template for an event type
func (r *Renderer) RenderEmailSubject(eventType string, data RenderData) (string, error) {
	templateName := eventType + ".email.subject"
	return r.Render(templateName, data)
}

// RenderEmailBody renders the email body template for an event type
func (r *Renderer) RenderEmailBody(eventType string, data RenderData) (string, error) {
	templateName := eventType + ".email.body"
	return r.Render(templateName, data)
}

// RegisterTemplate registers a custom template
func (r *Renderer) RegisterTemplate(name, templateText string) error {
	tmpl, err := template.New(name).Parse(templateText)
	if err != nil {
		return fmt.Errorf("failed to parse template: %w", err)
	}
	r.templates[name] = tmpl
	return nil
}
