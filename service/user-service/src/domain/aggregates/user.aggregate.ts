import { UserId } from '../value-objects/user-id.vo';
import { Email } from '../value-objects/email.vo';
import { Password } from '../value-objects/password.vo';
import { UserCreatedEvent } from '../events/user-created.event';
import { UserEmailChangedEvent } from '../events/user-email-changed.event';
import { UserPasswordChangedEvent } from '../events/user-password-changed.event';
import { UserActivatedEvent } from '../events/user-activated.event';
import { UserDeactivatedEvent } from '../events/user-deactivated.event';
import { UserSuspendedEvent } from '../events/user-suspended.event';
import { UserDeletedEvent } from '../events/user-deleted.event';
import { UserRoleAddedEvent } from '../events/user-role-added.event';
import { UserRoleRemovedEvent } from '../events/user-role-removed.event';
import { UserProfileUpdatedEvent } from '../events/user-profile-updated.event';
import { UserLoggedInEvent } from '../events/user-logged-in.event';
import { PasswordMismatchError } from '../errors/password-mismatch.error';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition.error';

/**
 * User status enum
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

/**
 * Domain event type union
 */
export type UserDomainEvent =
  | UserCreatedEvent
  | UserEmailChangedEvent
  | UserPasswordChangedEvent
  | UserActivatedEvent
  | UserDeactivatedEvent
  | UserSuspendedEvent
  | UserDeletedEvent
  | UserRoleAddedEvent
  | UserRoleRemovedEvent
  | UserProfileUpdatedEvent
  | UserLoggedInEvent;

/**
 * OAuth Provider types
 */
export type OAuthProvider = 'google' | 'facebook' | 'github';

/**
 * Props for creating a new User
 */
export interface CreateUserProps {
  tenantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  roleIds?: string[];
}

/**
 * Props for creating OAuth User
 */
export interface CreateOAuthUserProps {
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  provider: OAuthProvider;
  providerId: string;
  roleIds?: string[];
}

/**
 * Props for reconstituting User from persistence
 */
export interface UserProps {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  status: UserStatus;
  roleIds: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  provider?: OAuthProvider;
  providerId?: string;
}

/**
 * User Aggregate Root
 * Encapsulates all user-related business logic
 */
export class User {
  private _id: UserId;
  private _tenantId: string;
  private _email: Email;
  private _password: Password;
  private _firstName: string;
  private _lastName: string;
  private _displayName: string;
  private _status: UserStatus;
  private _roleIds: string[];
  private _createdAt: Date;
  private _updatedAt: Date;
  private _lastLoginAt?: Date;
  private _provider?: OAuthProvider;
  private _providerId?: string;

  private _domainEvents: UserDomainEvent[] = [];

  private constructor() {}

  /**
   * Create a new User (Factory method)
   */
  static create(props: CreateUserProps): User {
    const user = new User();

    user._id = UserId.create();
    user._tenantId = props.tenantId;
    user._email = Email.create(props.email);
    user._password = Password.create(props.password);
    user._firstName = props.firstName.trim();
    user._lastName = props.lastName.trim();
    user._displayName = props.displayName?.trim() || `${props.firstName} ${props.lastName}`;
    user._status = UserStatus.ACTIVE;
    user._roleIds = props.roleIds || [];
    user._createdAt = new Date();
    user._updatedAt = new Date();

    // Emit domain event
    user._domainEvents.push(
      new UserCreatedEvent(
        user._id.toString(),
        user._tenantId,
        user._email.toString(),
        user._firstName,
        user._lastName,
      ),
    );

    return user;
  }

  /**
   * Create OAuth User (no password required)
   */
  static createOAuthUser(props: CreateOAuthUserProps): User {
    const user = new User();

    user._id = UserId.create();
    user._tenantId = props.tenantId;
    user._email = Email.create(props.email);
    user._password = Password.createEmpty(); // No password for OAuth users
    user._firstName = props.firstName.trim();
    user._lastName = props.lastName.trim();
    user._displayName = props.displayName?.trim() || `${props.firstName} ${props.lastName}`;
    user._status = UserStatus.ACTIVE;
    user._roleIds = props.roleIds || [];
    user._provider = props.provider;
    user._providerId = props.providerId;
    user._createdAt = new Date();
    user._updatedAt = new Date();

    // Emit domain event
    user._domainEvents.push(
      new UserCreatedEvent(
        user._id.toString(),
        user._tenantId,
        user._email.toString(),
        user._firstName,
        user._lastName,
      ),
    );

    return user;
  }

  /**
   * Reconstitute User from persistence
   */
  static reconstitute(props: UserProps): User {
    const user = new User();

    user._id = UserId.fromString(props.id);
    user._tenantId = props.tenantId;
    user._email = Email.create(props.email);
    user._password = Password.fromHash(props.passwordHash, props.passwordSalt);
    user._firstName = props.firstName;
    user._lastName = props.lastName;
    user._displayName = props.displayName || `${props.firstName} ${props.lastName}`;
    user._status = props.status;
    user._roleIds = props.roleIds;
    user._createdAt = props.createdAt;
    user._updatedAt = props.updatedAt;
    user._lastLoginAt = props.lastLoginAt;
    user._provider = props.provider;
    user._providerId = props.providerId;

    return user;
  }

  // ============================================
  // Getters
  // ============================================
  get id(): UserId {
    return this._id;
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get email(): Email {
    return this._email;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get displayName(): string {
    return this._displayName;
  }

  get status(): UserStatus {
    return this._status;
  }

  get roleIds(): string[] {
    return [...this._roleIds];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get lastLoginAt(): Date | undefined {
    return this._lastLoginAt;
  }

  get domainEvents(): UserDomainEvent[] {
    return [...this._domainEvents];
  }

  get provider(): OAuthProvider | undefined {
    return this._provider;
  }

  get providerId(): string | undefined {
    return this._providerId;
  }

  /**
   * Check if user is OAuth user
   */
  isOAuthUser(): boolean {
    return !!this._provider;
  }

  // ============================================
  // Business Methods
  // ============================================

  /**
   * Verify password
   */
  verifyPassword(plainPassword: string): boolean {
    return this._password.verify(plainPassword);
  }

  /**
   * Change password
   */
  changePassword(currentPassword: string, newPassword: string): void {
    if (!this._password.verify(currentPassword)) {
      throw new PasswordMismatchError();
    }

    this._password = Password.create(newPassword);
    this._updatedAt = new Date();

    this._domainEvents.push(
      new UserPasswordChangedEvent(this._id.toString(), this._tenantId),
    );
  }

  /**
   * Change email
   */
  changeEmail(newEmail: string): void {
    const oldEmail = this._email.toString();
    const newEmailVO = Email.create(newEmail);

    if (this._email.equals(newEmailVO)) {
      return; // No change needed
    }

    this._email = newEmailVO;
    this._updatedAt = new Date();

    this._domainEvents.push(
      new UserEmailChangedEvent(
        this._id.toString(),
        this._tenantId,
        oldEmail,
        newEmail,
      ),
    );
  }

  /**
   * Update profile
   */
  updateProfile(props: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
  }): void {
    const updatedFields: string[] = [];

    if (props.firstName) {
      this._firstName = props.firstName.trim();
      updatedFields.push('firstName');
    }
    if (props.lastName) {
      this._lastName = props.lastName.trim();
      updatedFields.push('lastName');
    }
    if (props.displayName) {
      this._displayName = props.displayName.trim();
      updatedFields.push('displayName');
    }

    if (updatedFields.length > 0) {
      this._updatedAt = new Date();
      this._domainEvents.push(
        new UserProfileUpdatedEvent(
          this._id.toString(),
          this._tenantId,
          updatedFields,
        ),
      );
    }
  }

  /**
   * Record login
   */
  recordLogin(ipAddress?: string, userAgent?: string): void {
    this._lastLoginAt = new Date();
    this._updatedAt = new Date();

    this._domainEvents.push(
      new UserLoggedInEvent(
        this._id.toString(),
        this._tenantId,
        ipAddress,
        userAgent,
      ),
    );
  }

  /**
   * Update last login time (without event)
   */
  updateLastLogin(): void {
    this._lastLoginAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Activate user
   */
  activate(): void {
    if (this._status === UserStatus.DELETED) {
      throw new InvalidStatusTransitionError(this._status, UserStatus.ACTIVE);
    }

    const previousStatus = this._status;
    this._status = UserStatus.ACTIVE;
    this._updatedAt = new Date();

    this._domainEvents.push(
      new UserActivatedEvent(
        this._id.toString(),
        this._tenantId,
        previousStatus,
      ),
    );
  }

  /**
   * Deactivate user
   */
  deactivate(): void {
    const previousStatus = this._status;
    this._status = UserStatus.INACTIVE;
    this._updatedAt = new Date();

    this._domainEvents.push(
      new UserDeactivatedEvent(
        this._id.toString(),
        this._tenantId,
        previousStatus,
      ),
    );
  }

  /**
   * Suspend user
   */
  suspend(reason?: string): void {
    const previousStatus = this._status;
    this._status = UserStatus.SUSPENDED;
    this._updatedAt = new Date();

    this._domainEvents.push(
      new UserSuspendedEvent(
        this._id.toString(),
        this._tenantId,
        previousStatus,
        reason,
      ),
    );
  }

  /**
   * Soft delete user
   */
  delete(): void {
    this._status = UserStatus.DELETED;
    this._updatedAt = new Date();

    this._domainEvents.push(
      new UserDeletedEvent(
        this._id.toString(),
        this._tenantId,
        this._email.toString(),
      ),
    );
  }

  /**
   * Add role
   */
  addRole(roleId: string): void {
    if (!this._roleIds.includes(roleId)) {
      this._roleIds.push(roleId);
      this._updatedAt = new Date();

      this._domainEvents.push(
        new UserRoleAddedEvent(
          this._id.toString(),
          this._tenantId,
          roleId,
        ),
      );
    }
  }

  /**
   * Remove role
   */
  removeRole(roleId: string): void {
    const index = this._roleIds.indexOf(roleId);
    if (index > -1) {
      this._roleIds.splice(index, 1);
      this._updatedAt = new Date();

      this._domainEvents.push(
        new UserRoleRemovedEvent(
          this._id.toString(),
          this._tenantId,
          roleId,
        ),
      );
    }
  }

  /**
   * Clear domain events (call after persisting)
   */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Get password hash for persistence
   */
  getPasswordHash(): string {
    return this._password.getHash();
  }

  /**
   * Get password salt for persistence
   */
  getPasswordSalt(): string {
    return this._password.getSalt();
  }

  /**
   * Check if user is active
   */
  isActive(): boolean {
    return this._status === UserStatus.ACTIVE;
  }
}
