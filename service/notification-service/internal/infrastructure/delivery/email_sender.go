package delivery

import (
	"context"
	"fmt"
	"log"
	"net/smtp"

	"notification-service/internal/domain/notification"
	"notification-service/internal/domain/template"
)

// EmailConfig contains email sender configuration
type EmailConfig struct {
	SMTPHost     string
	SMTPPort     int
	Username     string
	Password     string
	FromAddress  string
	FromName     string
	Enabled      bool
}

// EmailSender sends notifications via email
type EmailSender struct {
	config    EmailConfig
	renderer  *template.Renderer
	available bool
}

// NewEmailSender creates a new EmailSender
func NewEmailSender(config EmailConfig, renderer *template.Renderer) *EmailSender {
	return &EmailSender{
		config:    config,
		renderer:  renderer,
		available: config.Enabled && config.SMTPHost != "",
	}
}

// Send sends an email notification
func (s *EmailSender) Send(ctx context.Context, n *notification.Notification) error {
	if !s.available {
		log.Printf("Email sender not available, skipping notification %s", n.ID)
		return nil
	}

	// Get recipient email from metadata
	toEmail, ok := n.Metadata["email"].(string)
	if !ok || toEmail == "" {
		log.Printf("No email address in notification metadata, skipping: %s", n.ID)
		return nil
	}

	// Render email content
	renderData := template.RenderData{
		Title:       n.Title,
		TaskTitle:   getMetadataString(n.Metadata, "task_title"),
		TaskID:      getMetadataString(n.Metadata, "task_id"),
		TaskURL:     getMetadataString(n.Metadata, "task_url"),
		ProjectID:   getMetadataString(n.Metadata, "project_id"),
		CreatorID:   getMetadataString(n.Metadata, "creator_id"),
		AssignedBy:  getMetadataString(n.Metadata, "assigned_by"),
		CompletedBy: getMetadataString(n.Metadata, "completed_by"),
		MentionedBy: getMetadataString(n.Metadata, "mentioned_by"),
		CommentText: getMetadataString(n.Metadata, "comment_text"),
		Metadata:    n.Metadata,
	}

	subject, err := s.renderer.RenderEmailSubject(n.SourceEvent, renderData)
	if err != nil {
		subject = n.Title
	}

	body, err := s.renderer.RenderEmailBody(n.SourceEvent, renderData)
	if err != nil {
		body = n.Body
	}

	// Send email
	if err := s.sendEmail(toEmail, subject, body); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("Email notification sent: %s to %s", n.ID, toEmail)
	return nil
}

func (s *EmailSender) sendEmail(to, subject, body string) error {
	from := s.config.FromAddress
	addr := fmt.Sprintf("%s:%d", s.config.SMTPHost, s.config.SMTPPort)

	// Build email message
	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("%s <%s>", s.config.FromName, from)
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + body

	// Create auth
	var auth smtp.Auth
	if s.config.Username != "" {
		auth = smtp.PlainAuth("", s.config.Username, s.config.Password, s.config.SMTPHost)
	}

	// Send email
	err := smtp.SendMail(addr, auth, from, []string{to}, []byte(message))
	if err != nil {
		return fmt.Errorf("SMTP error: %w", err)
	}

	return nil
}

// Channel returns the channel this sender handles
func (s *EmailSender) Channel() notification.Channel {
	return notification.ChannelEmail
}

// IsAvailable checks if the sender is available
func (s *EmailSender) IsAvailable() bool {
	return s.available
}

func getMetadataString(metadata map[string]interface{}, key string) string {
	if val, ok := metadata[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}
