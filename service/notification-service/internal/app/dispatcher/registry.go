package dispatcher

import (
	"notification-service/internal/app/handler"
	"notification-service/internal/infrastructure/delivery"
	"notification-service/internal/ports"
)

// Registry manages handler registration
type Registry struct {
	dispatcher  *Dispatcher
	baseHandler *handler.BaseHandler
}

// NewRegistry creates a new Registry
func NewRegistry(
	repo ports.NotificationRepository,
	multiSender *delivery.MultiChannelSenderImpl,
	idempotency ports.IdempotencyStore,
) *Registry {
	baseHandler := handler.NewBaseHandler(repo, multiSender, idempotency)
	dispatcher := NewDispatcher(idempotency)

	return &Registry{
		dispatcher:  dispatcher,
		baseHandler: baseHandler,
	}
}

// RegisterAllHandlers registers all event handlers
func (r *Registry) RegisterAllHandlers() *Dispatcher {
	// Register task event handlers
	r.dispatcher.RegisterHandler(handler.NewTaskCreatedHandler(r.baseHandler))
	r.dispatcher.RegisterHandler(handler.NewTaskAssignedHandler(r.baseHandler))
	r.dispatcher.RegisterHandler(handler.NewTaskCompletedHandler(r.baseHandler))
	r.dispatcher.RegisterHandler(handler.NewUserMentionedHandler(r.baseHandler))

	return r.dispatcher
}

// GetDispatcher returns the configured dispatcher
func (r *Registry) GetDispatcher() *Dispatcher {
	return r.dispatcher
}
