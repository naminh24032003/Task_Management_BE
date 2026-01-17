import { UserProfile } from '../entities/user-profile.entity';
import { AbstractSpecification, Specification } from './user-active-status.specification';

/**
 * User Age Requirement Specification
 * Checks if a user meets minimum age requirements
 */
export class UserAgeRequirementSpecification extends AbstractSpecification<UserProfile> {
  constructor(private readonly minimumAge: number) {
    super();
    if (minimumAge < 0) {
      throw new Error('Minimum age cannot be negative');
    }
  }

  isSatisfiedBy(profile: UserProfile): boolean {
    const age = profile.getAge();
    if (age === null) {
      return false; // No date of birth means we can't verify age
    }
    return age >= this.minimumAge;
  }
}

/**
 * User Maximum Age Specification
 * Checks if a user is below maximum age
 */
export class UserMaximumAgeSpecification extends AbstractSpecification<UserProfile> {
  constructor(private readonly maximumAge: number) {
    super();
    if (maximumAge < 0) {
      throw new Error('Maximum age cannot be negative');
    }
  }

  isSatisfiedBy(profile: UserProfile): boolean {
    const age = profile.getAge();
    if (age === null) {
      return true; // No date of birth, assume valid
    }
    return age <= this.maximumAge;
  }
}

/**
 * User Age Range Specification
 * Checks if a user is within a specific age range
 */
export class UserAgeRangeSpecification extends AbstractSpecification<UserProfile> {
  private readonly minAgeSpec: UserAgeRequirementSpecification;
  private readonly maxAgeSpec: UserMaximumAgeSpecification;

  constructor(minAge: number, maxAge: number) {
    super();
    if (minAge > maxAge) {
      throw new Error('Minimum age cannot be greater than maximum age');
    }
    this.minAgeSpec = new UserAgeRequirementSpecification(minAge);
    this.maxAgeSpec = new UserMaximumAgeSpecification(maxAge);
  }

  isSatisfiedBy(profile: UserProfile): boolean {
    return (
      this.minAgeSpec.isSatisfiedBy(profile) &&
      this.maxAgeSpec.isSatisfiedBy(profile)
    );
  }
}

/**
 * User Has Date Of Birth Specification
 * Checks if a user profile has date of birth set
 */
export class UserHasDateOfBirthSpecification extends AbstractSpecification<UserProfile> {
  isSatisfiedBy(profile: UserProfile): boolean {
    return profile.dateOfBirth !== undefined && profile.dateOfBirth !== null;
  }
}

/**
 * User Is Adult Specification
 * Checks if user is 18 or older
 */
export class UserIsAdultSpecification extends UserAgeRequirementSpecification {
  constructor() {
    super(18);
  }
}

/**
 * User Is Minor Specification
 * Checks if user is under 18
 */
export class UserIsMinorSpecification extends AbstractSpecification<UserProfile> {
  private readonly adultSpec = new UserIsAdultSpecification();

  isSatisfiedBy(profile: UserProfile): boolean {
    if (profile.getAge() === null) {
      return false; // Can't determine if minor without age
    }
    return !this.adultSpec.isSatisfiedBy(profile);
  }
}

/**
 * Age Specification Factory
 */
export class AgeSpecifications {
  static minimumAge(age: number): UserAgeRequirementSpecification {
    return new UserAgeRequirementSpecification(age);
  }

  static maximumAge(age: number): UserMaximumAgeSpecification {
    return new UserMaximumAgeSpecification(age);
  }

  static ageRange(minAge: number, maxAge: number): UserAgeRangeSpecification {
    return new UserAgeRangeSpecification(minAge, maxAge);
  }

  static isAdult(): UserIsAdultSpecification {
    return new UserIsAdultSpecification();
  }

  static isMinor(): UserIsMinorSpecification {
    return new UserIsMinorSpecification();
  }

  static hasDateOfBirth(): UserHasDateOfBirthSpecification {
    return new UserHasDateOfBirthSpecification();
  }

  /**
   * Common age restrictions
   */
  static canUseService(): Specification<UserProfile> {
    return new UserAgeRequirementSpecification(13); // COPPA compliance
  }

  static canPurchase(): Specification<UserProfile> {
    return new UserIsAdultSpecification();
  }

  static seniorCitizen(): Specification<UserProfile> {
    return new UserAgeRequirementSpecification(65);
  }
}
