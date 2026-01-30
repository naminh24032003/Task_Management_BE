// Package port defines the application-level interfaces (ports) for the task service.
//
// In Hexagonal Architecture (Ports & Adapters), ports are interfaces that define
// how the application core interacts with the outside world:
//
//   - Input Ports: Define how external actors can interact with the application
//     (implemented by handlers in the application layer)
//
//   - Output Ports: Define how the application interacts with external services
//     (implemented by adapters in the infrastructure layer)
//
// This package contains Output Ports:
//   - EventPublisher: For publishing domain events to message brokers
//   - UnitOfWork: For transactional operations with outbox pattern
//   - TaskFinder: For read-only task lookup operations
//
// Benefits of separating ports:
//   - Clear contracts between layers
//   - Easy to mock for testing
//   - Flexibility to swap implementations (Kafka → RabbitMQ, MongoDB → PostgreSQL)
//   - Follows Dependency Inversion Principle
package port
