// Domain Layer Barrel Export

// Aggregates
export * from './domain/aggregates/user.aggregate';

// Value Objects
export * from './domain/value-objects/user-id.vo';
export * from './domain/value-objects/email.vo';
export * from './domain/value-objects/password.vo';

// Domain Events
export * from './domain/events/user-created.event';
export * from './domain/events/user-email-changed.event';
export * from './domain/events/user-password-changed.event';

// Domain Errors
export * from './domain/errors/user-domain.error';
export * from './domain/errors/invalid-email.error';
export * from './domain/errors/weak-password.error';
