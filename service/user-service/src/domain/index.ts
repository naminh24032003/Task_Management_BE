// Types (centralized interfaces)
export * from './types';

// Aggregates
export {
  User,
  UserDomainEvent,
} from './aggregates/user.aggregate';

// Entities
export { UserProfile } from './entities/user-profile.entity';

export { Role } from './entities/role.entity';
export { Permission } from './entities/permission.entity';

// Value Objects
export { UserId } from './value-objects/user-id.vo';
export { Email } from './value-objects/email.vo';
export { Password } from './value-objects/password.vo';

// Domain Events
export { UserCreatedEvent } from './events/user-created.event';
export { UserEmailChangedEvent } from './events/user-email-changed.event';
export { UserPasswordChangedEvent } from './events/user-password-changed.event';
export { UserActivatedEvent } from './events/user-activated.event';
export { UserDeactivatedEvent } from './events/user-deactivated.event';
export { UserSuspendedEvent } from './events/user-suspended.event';
export { UserDeletedEvent } from './events/user-deleted.event';
export { UserRoleAddedEvent } from './events/user-role-added.event';
export { UserRoleRemovedEvent } from './events/user-role-removed.event';
export { UserProfileUpdatedEvent } from './events/user-profile-updated.event';
export { UserLoggedInEvent } from './events/user-logged-in.event';

// Domain Errors
export { UserDomainError } from './errors/user-domain.error';
export { InvalidEmailError } from './errors/invalid-email.error';
export { WeakPasswordError } from './errors/weak-password.error';
export { UserNotFoundError } from './errors/user-not-found.error';
export { UserAlreadyExistsError } from './errors/user-already-exists.error';
export { InvalidStatusTransitionError } from './errors/invalid-status-transition.error';
export { InvalidCredentialsError } from './errors/invalid-credentials.error';
export { UserInactiveError } from './errors/user-inactive.error';
export { UserSuspendedError } from './errors/user-suspended.error';
export { DuplicateRoleError } from './errors/duplicate-role.error';
export { RoleNotFoundError } from './errors/role-not-found.error';
export { PasswordMismatchError } from './errors/password-mismatch.error';

// Domain Services
export {
  PasswordPolicyService,
  PasswordPolicyConfig,
  PasswordValidationResult,
  defaultPasswordPolicy,
} from './services/password-policy.service';

export {
  UserValidationService,
  UserValidationConfig,
  ValidationResult,
  ValidationError,
  defaultUserValidationService,
} from './services/user-validation.service';

// Specifications
export {
  Specification,
  AbstractSpecification,
  UserActiveStatusSpecification,
  UserInactiveStatusSpecification,
  UserSuspendedStatusSpecification,
  UserDeletedStatusSpecification,
  UserCanLoginSpecification,
  UserStatusSpecifications,
} from './specifications/user-active-status.specification';

export {
  UserAgeRequirementSpecification,
  UserMaximumAgeSpecification,
  UserAgeRangeSpecification,
  UserHasDateOfBirthSpecification,
  UserIsAdultSpecification,
  UserIsMinorSpecification,
  AgeSpecifications,
} from './specifications/user-age-requirement.specification';

export {
  EmailUniquenessChecker,
  UserEmailUniqueSpecification,
  UserEmailDomainSpecification,
  UserEmailNotBlockedDomainSpecification,
  UserEmailVerifiedSpecification,
  UserHasCorporateEmailSpecification,
  EmailSpecifications,
} from './specifications/user-email-unique.specification';
