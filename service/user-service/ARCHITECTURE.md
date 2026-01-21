# User Service Architecture

## Overview

User Service được xây dựng theo **DDD (Domain-Driven Design)** và **Clean Architecture** với các pattern:
- **CQRS** (Command Query Responsibility Segregation)
- **Hexagonal Architecture** (Ports & Adapters)
- **Rich Domain Model**

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Layer Architecture](#layer-architecture)
3. [Request Flow](#request-flow)
4. [CQRS Pattern](#cqrs-pattern)
5. [Domain Layer](#domain-layer)
6. [Application Layer](#application-layer)
7. [Infrastructure Layer](#infrastructure-layer)
8. [Authentication & Authorization](#authentication--authorization)
9. [Code Examples](#code-examples)

---

## Directory Structure

```
src/
├── application/                 # Application Layer (Use Cases)
│   ├── commands/                # Write operations (CQRS)
│   │   ├── create-user/
│   │   │   ├── create-user.command.ts
│   │   │   └── create-user.handler.ts
│   │   ├── login/
│   │   ├── change-password/
│   │   ├── update-user/
│   │   └── ...
│   ├── queries/                 # Read operations (CQRS)
│   │   ├── get-user-by-id/
│   │   ├── get-user-by-email/
│   │   └── list-users/
│   ├── ports/                   # Interfaces (Hexagonal)
│   │   ├── user-repository.port.ts
│   │   └── oauth.port.ts
│   ├── dtos/                    # Data Transfer Objects
│   ├── services/                # Application Services
│   ├── errors/                  # Application Errors
│   └── integration-events/      # Events for external systems
│
├── domain/                      # Domain Layer (Core Business Logic)
│   ├── aggregates/              # Aggregate Roots
│   │   └── user.aggregate.ts
│   ├── entities/                # Domain Entities
│   ├── value-objects/           # Value Objects
│   │   ├── email.vo.ts
│   │   ├── password.vo.ts
│   │   └── user-id.vo.ts
│   ├── events/                  # Domain Events
│   │   ├── user-created.event.ts
│   │   ├── user-password-changed.event.ts
│   │   └── ...
│   ├── specifications/          # Business Rules
│   │   ├── user-email-unique.specification.ts
│   │   └── user-active-status.specification.ts
│   ├── services/                # Domain Services
│   │   ├── password-policy.service.ts
│   │   └── user-validation.service.ts
│   └── errors/                  # Domain Errors
│
├── infrastructure/              # Infrastructure Layer
│   ├── database/
│   │   ├── mongodb/
│   │   │   ├── schemas/
│   │   │   └── repositories/
│   │   └── typeorm/
│   │       ├── entities/
│   │       └── repositories/
│   ├── grpc/                    # gRPC Controllers
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── interceptors/
│   │   ├── guards/
│   │   └── decorators/
│   ├── config/
│   ├── redis/
│   └── adapters/
│
└── generated/                   # Generated Proto files
    └── user/v1/
```

---

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE LAYER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   gRPC      │  │  MongoDB    │  │  TypeORM    │  │   Redis     │   │
│  │ Controllers │  │   Repos     │  │   Repos     │  │   Cache     │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘   │
│         │                │                │                            │
│         │         implements        implements                         │
└─────────┼────────────────┼────────────────┼────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Commands   │  │   Queries   │  │    Ports    │  │ Integration │   │
│  │  Handlers   │  │   Handlers  │  │ (Interfaces)│  │   Events    │   │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘  └─────────────┘   │
│         │                │                                             │
│         │     uses       │                                             │
└─────────┼────────────────┼─────────────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            DOMAIN LAYER                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Aggregates  │  │   Value     │  │   Domain    │  │   Domain    │   │
│  │   (User)    │  │  Objects    │  │   Events    │  │  Services   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
│                    *** PURE - NO EXTERNAL DEPENDENCIES ***              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Dependency Rule

```
Infrastructure ──depends on──> Application ──depends on──> Domain

Domain: KHÔNG import từ Application hoặc Infrastructure
Application: Chỉ định nghĩa interfaces (ports)
Infrastructure: Implement các ports
```

---

## Request Flow

### Overall Flow

```
┌────────┐     ┌──────────┐     ┌─────────────┐     ┌─────────────┐
│ Client │────>│   Kong   │────>│gRPC Gateway │────>│User Service │
└────────┘     │  (AuthN) │     │(HTTP→gRPC)  │     │   (AuthZ)   │
               └──────────┘     └─────────────┘     └─────────────┘
                    │                                      │
             ● Verify JWT                           ● Extract identity
             ● Check exp                            ● Business logic
             ● Inject headers:                      ● Persist data
               - x-user-id
               - x-tenant-id
               - x-roles
               - x-permissions
```

### Detailed Flow: Create User

```
1. CLIENT REQUEST
   POST /v1/users
   Body: { email, password, firstName, lastName }
   Header: Authorization: Bearer <token>
              │
              ▼
2. KONG (AuthN)
   ● Verify JWT signature & expiration
   ● Inject headers: x-user-id, x-tenant-id, x-roles
              │
              ▼
3. gRPC GATEWAY
   ● Convert HTTP → gRPC
   ● Map headers → metadata
              │
              ▼
4. GrpcAuthInterceptor
   infrastructure/grpc/interceptors/grpc-auth.interceptor.ts
   ● Extract identity from metadata
   ● Store in context
              │
              ▼
5. GrpcAuthGuard
   infrastructure/grpc/guards/grpc-auth.guard.ts
   ● Verify user authenticated
   ● Check tenant exists
              │
              ▼
6. UserController.createUser()
   infrastructure/grpc/user.controller.ts
   ● Extract tenantId from metadata
   ● Dispatch to CommandBus
              │
              ▼
7. CreateUserHandler.execute()
   application/commands/create-user/create-user.handler.ts
   ● Check email uniqueness
   ● Call User.create() factory
   ● Save via repository
   ● Publish integration event
              │
              ▼
8. User.create() - DOMAIN
   domain/aggregates/user.aggregate.ts
   ● Create UserId (Value Object)
   ● Create Email (Value Object with validation)
   ● Create Password (Value Object with hashing)
   ● Emit UserCreatedEvent (Domain Event)
              │
              ▼
9. Repository.save()
   infrastructure/database/.../user.repository.ts
   ● Convert Domain → DB Entity
   ● Persist to MongoDB/PostgreSQL
   ● Clear domain events
              │
              ▼
10. RESPONSE
    { user: { id, email, firstName, status, ... } }
```

### Login Flow

```
POST /v1/auth/login { tenant_id, email, password }
              │
              ▼
┌─────────────────────────────────────────────────────┐
│ AuthController.login()                              │
│ → commandBus.execute(new LoginCommand(...))         │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│ LoginHandler.execute()                              │
│                                                     │
│ 1. user = userRepo.findByEmail(tenantId, email)    │
│    → if (!user) throw UserNotFoundError            │
│                                                     │
│ 2. if (!user.isActive())                           │
│    → throw UserNotActiveError                      │
│                                                     │
│ 3. if (!user.verifyPassword(password))             │
│    → throw InvalidCredentialsError                 │
│                                                     │
│ 4. user.recordLogin(ip, userAgent)                 │
│    → Emit UserLoggedInEvent                        │
│    → userRepo.save(user)                           │
│                                                     │
│ 5. tokens = jwtService.generateTokens(user)        │
│    → return { accessToken, refreshToken, user }    │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│ User.verifyPassword() - Domain Method               │
│ → this._password.verify(plainPassword)             │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│ Password.verify() - Value Object                    │
│ → crypto.pbkdf2Sync(plain, salt) === hash          │
└─────────────────────────────────────────────────────┘
```

---

## CQRS Pattern

```
                    ┌─────────────────┐
                    │   Controller    │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
      ┌───────────────┐             ┌───────────────┐
      │  CommandBus   │             │   QueryBus    │
      │    (Write)    │             │    (Read)     │
      └───────┬───────┘             └───────┬───────┘
              │                             │
   ┌──────────┼──────────┐                  │
   │          │          │                  │
   ▼          ▼          ▼                  ▼
┌──────┐  ┌──────┐  ┌──────┐         ┌───────────┐
│Create│  │Update│  │Delete│         │ GetById   │
│User  │  │User  │  │User  │         │ ListUsers │
└──┬───┘  └──┬───┘  └──┬───┘         └─────┬─────┘
   │         │         │                   │
   ▼         ▼         ▼                   ▼
┌─────────────────────────┐       ┌─────────────────┐
│     WRITE MODEL         │       │   READ MODEL    │
│   Domain Aggregates     │       │  Direct Query   │
│                         │       │                 │
│ • User.create()         │       │ • SELECT *      │
│ • user.changePassword() │       │   FROM users    │
│ • user.activate()       │       │   WHERE ...     │
└─────────────────────────┘       └─────────────────┘
```

### Commands (Write)

| Command | Handler | Description |
|---------|---------|-------------|
| `CreateUserCommand` | `CreateUserHandler` | Tạo user mới |
| `LoginCommand` | `LoginHandler` | Đăng nhập |
| `RegisterUserCommand` | `RegisterUserHandler` | Đăng ký |
| `ChangePasswordCommand` | `ChangePasswordHandler` | Đổi mật khẩu |
| `UpdateUserCommand` | `UpdateUserHandler` | Cập nhật profile |
| `DeleteUserCommand` | `DeleteUserHandler` | Xóa user |
| `AssignRolesCommand` | `AssignRolesHandler` | Gán roles |
| `UpdateUserStatusCommand` | `UpdateUserStatusHandler` | Thay đổi status |

### Queries (Read)

| Query | Handler | Description |
|-------|---------|-------------|
| `GetUserByIdQuery` | `GetUserByIdHandler` | Lấy user theo ID |
| `GetUserByEmailQuery` | `GetUserByEmailHandler` | Lấy user theo email |
| `ListUsersQuery` | `ListUsersHandler` | Danh sách users |

---

## Domain Layer

### Aggregate Root: User

```typescript
// domain/aggregates/user.aggregate.ts

export class User {
  // Private fields - encapsulation
  private _id: UserId;
  private _email: Email;
  private _password: Password;
  private _status: UserStatus;
  private _domainEvents: UserDomainEvent[] = [];

  // Factory method - không dùng public constructor
  static create(props: CreateUserProps): User {
    const user = new User();
    user._id = UserId.create();
    user._email = Email.create(props.email);      // Validation trong VO
    user._password = Password.create(props.password); // Hash trong VO
    user._status = UserStatus.ACTIVE;

    // Emit domain event
    user._domainEvents.push(new UserCreatedEvent(...));

    return user;
  }

  // Reconstitute từ DB (không emit event)
  static reconstitute(props: UserProps): User { ... }

  // Business methods
  verifyPassword(plain: string): boolean {
    return this._password.verify(plain);
  }

  changePassword(current: string, newPass: string): void {
    if (!this.verifyPassword(current)) {
      throw new PasswordMismatchError();
    }
    this._password = Password.create(newPass);
    this._domainEvents.push(new UserPasswordChangedEvent(...));
  }

  activate(): void {
    if (this._status === UserStatus.DELETED) {
      throw new InvalidStatusTransitionError(...);
    }
    this._status = UserStatus.ACTIVE;
    this._domainEvents.push(new UserActivatedEvent(...));
  }

  // Clear events after persistence
  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
```

### Value Objects

```typescript
// domain/value-objects/email.vo.ts

export class Email {
  private constructor(private readonly value: string) {
    Object.freeze(this);  // Immutable
  }

  static create(email: string): Email {
    const normalized = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalized)) {
      throw new InvalidEmailError();
    }

    return new Email(normalized);
  }

  toString(): string { return this.value; }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  getDomain(): string {
    return this.value.split('@')[1];
  }
}
```

```typescript
// domain/value-objects/password.vo.ts

export class Password {
  private constructor(
    private readonly hash: string,
    private readonly salt: string
  ) {
    Object.freeze(this);
  }

  static create(plainPassword: string): Password {
    // Validate password policy
    if (plainPassword.length < 8) {
      throw new WeakPasswordError();
    }

    // Generate salt and hash
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(plainPassword, salt, 10000, 64, 'sha512');

    return new Password(hash.toString('hex'), salt);
  }

  verify(plainPassword: string): boolean {
    const hash = crypto.pbkdf2Sync(plainPassword, this.salt, 10000, 64, 'sha512');
    return hash.toString('hex') === this.hash;
  }
}
```

### Domain Events

```typescript
// domain/events/user-created.event.ts

export class UserCreatedEvent {
  public readonly eventName = 'UserCreated';
  public readonly occurredAt: Date;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
  ) {
    this.occurredAt = new Date();
    Object.freeze(this);
  }
}
```

### Specifications

```typescript
// domain/specifications/user-email-unique.specification.ts

export class UserEmailUniqueSpecification {
  constructor(private readonly emailChecker: EmailUniquenessChecker) {}

  async isSatisfiedBy(tenantId: string, email: string): Promise<boolean> {
    return this.emailChecker.isEmailUnique(tenantId, email);
  }
}
```

---

## Application Layer

### Command Handler Example

```typescript
// application/commands/create-user/create-user.handler.ts

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,  // Port interface
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    // 1. Business validation
    const existing = await this.userRepository.findByEmail(
      command.tenantId,
      command.email
    );
    if (existing) {
      throw new Error('Email already registered');
    }

    // 2. Create domain aggregate
    const user = User.create({
      tenantId: command.tenantId,
      email: command.email,
      password: command.password,
      firstName: command.firstName,
      lastName: command.lastName,
    });

    // 3. Persist
    const savedUser = await this.userRepository.save(user);

    // 4. Publish integration event (for external systems)
    this.eventBus.publish(
      new UserRegisteredEvent(
        savedUser.id.toString(),
        savedUser.tenantId,
        savedUser.email.toString(),
      ),
    );

    return { user: savedUser };
  }
}
```

### Port Interface

```typescript
// application/ports/user-repository.port.ts

export interface IUserRepository {
  findById(tenantId: string, userId: string): Promise<User | null>;
  findByEmail(tenantId: string, email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(tenantId: string, userId: string): Promise<void>;
  findAll(tenantId: string, options: ListUsersDto): Promise<{ users: User[]; total: number }>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
```

---

## Infrastructure Layer

### gRPC Controller

```typescript
// infrastructure/grpc/user.controller.ts

@Controller()
@UserServiceControllerMethods()
@UseInterceptors(GrpcAuthInterceptor)
export class UserController implements UserServiceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @UseGuards(GrpcAuthGuard)
  async getMe(_request: GetMeRequest, metadata?: Metadata): Promise<GetMeResponse> {
    const tenantId = this.extractTenantId(metadata);
    const userId = this.extractUserId(metadata);

    const result = await this.queryBus.execute(
      new GetUserByIdQuery(tenantId, userId),
    );

    return { user: this.toProtoUser(result.user) };
  }

  @GrpcMethod('UserService', 'CreateUser')
  @UseGuards(GrpcAuthGuard)
  async createUser(request: CreateUserRequest, metadata?: Metadata): Promise<CreateUserResponse> {
    const tenantId = this.extractTenantId(metadata);

    const result = await this.commandBus.execute(
      new CreateUserCommand(
        tenantId,
        request.email,
        request.password,
        request.firstName,
        request.lastName,
      ),
    );

    return { user: this.toProtoUser(result.user) };
  }
}
```

### Repository Implementation

```typescript
// infrastructure/database/mongodb/repositories/user-domain.repository.ts

@Injectable()
export class UserDomainRepository implements IUserRepository {
  constructor(
    @InjectModel(UserSchema.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async save(user: User): Promise<User> {
    // Convert Domain Aggregate → DB Entity
    const entity = {
      userId: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.toString(),
      passwordHash: user.getPasswordHash(),
      passwordSalt: user.getPasswordSalt(),
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roleIds: user.roleIds,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    await this.userModel.findOneAndUpdate(
      { userId: entity.userId },
      entity,
      { upsert: true, new: true },
    );

    // Clear domain events after persistence
    user.clearDomainEvents();

    return user;
  }

  async findById(tenantId: string, userId: string): Promise<User | null> {
    const doc = await this.userModel.findOne({ tenantId, userId });
    if (!doc) return null;

    // Reconstitute Domain Aggregate from DB Entity
    return User.reconstitute({
      id: doc.userId,
      tenantId: doc.tenantId,
      email: doc.email,
      passwordHash: doc.passwordHash,
      passwordSalt: doc.passwordSalt,
      firstName: doc.firstName,
      lastName: doc.lastName,
      status: doc.status as UserStatus,
      roleIds: doc.roleIds,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
```

---

## Authentication & Authorization

### Flow

```
┌────────┐    ┌───────────┐    ┌─────────────┐    ┌─────────────────┐
│ Client │───>│   Kong    │───>│gRPC Gateway │───>│  User Service   │
│        │    │  (AuthN)  │    │             │    │    (AuthZ)      │
└────────┘    └───────────┘    └─────────────┘    └─────────────────┘
     │              │                 │                   │
     │              │                 │                   │
     │         Verify JWT        Map headers         Extract identity
     │         Check exp         to metadata         Check guards
     │         Inject headers                        Execute logic
     │         ↓
     │    x-user-id
     │    x-tenant-id
     │    x-roles
     │    x-permissions
     │    x-email
```

### Guards

```typescript
// infrastructure/grpc/guards/grpc-auth.guard.ts

@Injectable()
export class GrpcAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const identity = extractGrpcUserIdentity(context);

    if (!identity || !identity.userId) {
      throw new RpcException({
        code: 'UNAUTHENTICATED',
        message: 'User not authenticated',
      });
    }

    return true;
  }
}
```

### Interceptor

```typescript
// infrastructure/grpc/interceptors/grpc-auth.interceptor.ts

@Injectable()
export class GrpcAuthInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = context.switchToRpc().getContext() as Metadata;

    // Extract identity from Kong-injected headers
    const identity: GrpcUserIdentity = {
      userId: metadata.get('x-user-id')?.[0]?.toString() || '',
      tenantId: metadata.get('x-tenant-id')?.[0]?.toString() || '',
      email: metadata.get('x-email')?.[0]?.toString(),
      roles: metadata.get('x-roles')?.[0]?.toString().split(',') || [],
      permissions: metadata.get('x-permissions')?.[0]?.toString().split(',') || [],
    };

    // Store in metadata for guards and handlers
    metadata.set(GRPC_USER_IDENTITY, JSON.stringify(identity));

    return next.handle();
  }
}
```

---

## Code Examples

### Full Flow: Register User

```typescript
// 1. Client calls: POST /v1/auth/register

// 2. AuthController
@GrpcMethod('AuthService', 'Register')
async register(request: RegisterRequest): Promise<RegisterResponse> {
  const result = await this.commandBus.execute(
    new RegisterUserCommand(
      request.tenantId,
      request.email,
      request.password,
      request.firstName,
      request.lastName,
    ),
  );
  return { user: result.user, accessToken: result.accessToken };
}

// 3. RegisterUserHandler
async execute(command: RegisterUserCommand) {
  // Check email unique
  const exists = await this.userRepository.emailExists(command.tenantId, command.email);
  if (exists) throw new EmailAlreadyExistsError();

  // Create user (Domain)
  const user = User.create({
    tenantId: command.tenantId,
    email: command.email,
    password: command.password,
    firstName: command.firstName,
    lastName: command.lastName,
  });

  // Save (Infrastructure)
  await this.userRepository.save(user);

  // Generate tokens
  const tokens = this.jwtService.generateTokens(user);

  // Publish event
  this.eventBus.publish(new UserRegisteredEvent(...));

  return { user, ...tokens };
}

// 4. User.create() - Domain
static create(props) {
  const user = new User();
  user._id = UserId.create();                    // Generate UUID
  user._email = Email.create(props.email);       // Validate & normalize
  user._password = Password.create(props.password); // Hash password
  user._status = UserStatus.ACTIVE;

  user._domainEvents.push(new UserCreatedEvent(...));

  return user;
}

// 5. Email.create() - Value Object
static create(email: string): Email {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new InvalidEmailError();
  }
  return new Email(normalized);
}

// 6. Password.create() - Value Object
static create(plain: string): Password {
  if (plain.length < 8) throw new WeakPasswordError();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plain, salt, 10000, 64, 'sha512');
  return new Password(hash.toString('hex'), salt);
}

// 7. Repository.save() - Infrastructure
async save(user: User): Promise<User> {
  const entity = this.toEntity(user);
  await this.model.create(entity);
  user.clearDomainEvents();
  return user;
}
```

---

## Summary

| Pattern | Implementation |
|---------|---------------|
| **DDD Aggregate** | `User` class với factory methods, business logic, domain events |
| **Value Objects** | `Email`, `Password`, `UserId` - immutable, self-validating |
| **Domain Events** | Emitted từ Aggregate khi state thay đổi |
| **CQRS** | Tách `Commands` (write) và `Queries` (read) |
| **Hexagonal** | `Ports` (interfaces) trong Application, `Adapters` trong Infrastructure |
| **Dependency Inversion** | Domain không phụ thuộc Infrastructure |
| **Specification** | Business rules encapsulated |

---

## References

- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture by Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- [CQRS by Martin Fowler](https://martinfowler.com/bliki/CQRS.html)
