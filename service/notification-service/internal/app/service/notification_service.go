package service

import (
	"context"
	"fmt"

	"notification-service/internal/domain/notification"
	"notification-service/internal/infrastructure/delivery"
	"notification-service/internal/ports"
)

// NotificationService provides notification business operations
type NotificationService struct {
	repo        ports.NotificationRepository
	multiSender *delivery.MultiChannelSenderImpl
}

// NewNotificationService creates a new NotificationService
func NewNotificationService(
	repo ports.NotificationRepository,
	multiSender *delivery.MultiChannelSenderImpl,
) *NotificationService {
	return &NotificationService{
		repo:        repo,
		multiSender: multiSender,
	}
}

// CreateNotification creates and sends a notification
func (s *NotificationService) CreateNotification(
	ctx context.Context,
	userID string,
	notificationType string,
	title string,
	body string,
	channel notification.Channel,
	priority notification.Priority,
	sourceEvent string,
	sourceID string,
	metadata map[string]interface{},
) (*notification.Notification, error) {
	// Create notification
	notif := notification.NewNotification(
		userID,
		notificationType,
		title,
		body,
		channel,
		priority,
		sourceEvent,
		sourceID,
		metadata,
	)

	// Save to database
	if err := s.repo.Create(ctx, notif); err != nil {
		return nil, fmt.Errorf("failed to create notification: %w", err)
	}

	// Send notification
	if sender, ok := s.multiSender.GetSender(channel); ok && sender.IsAvailable() {
		if err := sender.Send(ctx, notif); err != nil {
			notif.MarkAsFailed(err.Error())
			s.repo.Update(ctx, notif)
			return notif, fmt.Errorf("failed to send notification: %w", err)
		}
		notif.MarkAsSent()
		s.repo.Update(ctx, notif)
	}

	return notif, nil
}

// GetNotification gets a notification by ID
func (s *NotificationService) GetNotification(ctx context.Context, id string) (*notification.Notification, error) {
	return s.repo.FindByID(ctx, id)
}

// GetUserNotifications gets notifications for a user
func (s *NotificationService) GetUserNotifications(ctx context.Context, userID string, limit, offset int) ([]*notification.Notification, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.FindByUserID(ctx, userID, limit, offset)
}

// GetUnreadNotifications gets unread notifications for a user
func (s *NotificationService) GetUnreadNotifications(ctx context.Context, userID string, limit, offset int) ([]*notification.Notification, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.FindUnreadByUserID(ctx, userID, limit, offset)
}

// GetUserNotificationsWithCursor gets notifications for a user with cursor-based pagination
func (s *NotificationService) GetUserNotificationsWithCursor(ctx context.Context, userID string, cursor string, limit int) ([]*notification.Notification, string, bool, error) {
	return s.repo.FindByUserIDWithCursor(ctx, userID, cursor, limit)
}

// GetUnreadNotificationsWithCursor gets unread notifications for a user with cursor-based pagination
func (s *NotificationService) GetUnreadNotificationsWithCursor(ctx context.Context, userID string, cursor string, limit int) ([]*notification.Notification, string, bool, error) {
	return s.repo.FindUnreadByUserIDWithCursor(ctx, userID, cursor, limit)
}

// GetUnreadCount gets the count of unread notifications for a user
func (s *NotificationService) GetUnreadCount(ctx context.Context, userID string) (int64, error) {
	return s.repo.CountUnreadByUserID(ctx, userID)
}

// MarkAsRead marks a notification as read
func (s *NotificationService) MarkAsRead(ctx context.Context, id string) error {
	return s.repo.MarkAsRead(ctx, id)
}

// MarkAllAsRead marks all notifications as read for a user
func (s *NotificationService) MarkAllAsRead(ctx context.Context, userID string) error {
	return s.repo.MarkAllAsReadByUserID(ctx, userID)
}

// DeleteNotification deletes a notification
func (s *NotificationService) DeleteNotification(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

// SendToMultipleChannels sends a notification through multiple channels
func (s *NotificationService) SendToMultipleChannels(
	ctx context.Context,
	notif *notification.Notification,
	channels []notification.Channel,
) []ports.SendResult {
	return s.multiSender.SendToChannels(ctx, notif, channels)
}
