import {
  UserProfileProps,
  SocialLinks,
  UserPreferences,
} from '../types';

// Re-export types for backward compatibility
export { UserProfileProps, SocialLinks, UserPreferences };

/**
 * UserProfile Entity
 * Manages extended user profile information
 */
export class UserProfile {
  private _userId: string;
  private _tenantId: string;
  private _avatar?: string;
  private _bio?: string;
  private _phoneNumber?: string;
  private _dateOfBirth?: Date;
  private _timezone: string;
  private _locale: string;
  private _socialLinks: SocialLinks;
  private _preferences: UserPreferences;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor() {}

  /**
   * Create a new UserProfile
   */
  static create(userId: string, tenantId: string): UserProfile {
    const profile = new UserProfile();

    profile._userId = userId;
    profile._tenantId = tenantId;
    profile._timezone = 'UTC';
    profile._locale = 'en';
    profile._socialLinks = {};
    profile._preferences = {
      emailNotifications: true,
      pushNotifications: true,
      theme: 'system',
      language: 'en',
    };
    profile._createdAt = new Date();
    profile._updatedAt = new Date();

    return profile;
  }

  /**
   * Reconstitute UserProfile from persistence
   */
  static reconstitute(props: UserProfileProps): UserProfile {
    const profile = new UserProfile();

    profile._userId = props.userId;
    profile._tenantId = props.tenantId;
    profile._avatar = props.avatar;
    profile._bio = props.bio;
    profile._phoneNumber = props.phoneNumber;
    profile._dateOfBirth = props.dateOfBirth;
    profile._timezone = props.timezone || 'UTC';
    profile._locale = props.locale || 'en';
    profile._socialLinks = props.socialLinks || {};
    profile._preferences = props.preferences || {
      emailNotifications: true,
      pushNotifications: true,
      theme: 'system',
      language: 'en',
    };
    profile._createdAt = props.createdAt;
    profile._updatedAt = props.updatedAt;

    return profile;
  }

  // Getters
  get userId(): string {
    return this._userId;
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get avatar(): string | undefined {
    return this._avatar;
  }

  get bio(): string | undefined {
    return this._bio;
  }

  get phoneNumber(): string | undefined {
    return this._phoneNumber;
  }

  get dateOfBirth(): Date | undefined {
    return this._dateOfBirth;
  }

  get timezone(): string {
    return this._timezone;
  }

  get locale(): string {
    return this._locale;
  }

  get socialLinks(): SocialLinks {
    return { ...this._socialLinks };
  }

  get preferences(): UserPreferences {
    return { ...this._preferences };
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Calculate age from date of birth
   */
  getAge(): number | null {
    if (!this._dateOfBirth) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - this._dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - this._dateOfBirth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < this._dateOfBirth.getDate())
    ) {
      age--;
    }

    return age;
  }

  // Business Methods
  updateAvatar(avatar: string): void {
    if (avatar && avatar.length > 500) {
      throw new Error('Avatar URL too long');
    }
    this._avatar = avatar;
    this._updatedAt = new Date();
  }

  updateBio(bio: string): void {
    if (bio && bio.length > 500) {
      throw new Error('Bio cannot exceed 500 characters');
    }
    this._bio = bio;
    this._updatedAt = new Date();
  }

  updatePhoneNumber(phoneNumber: string): void {
    // Basic phone number validation
    if (phoneNumber && !/^[+]?[\d\s\-()]{7,20}$/.test(phoneNumber)) {
      throw new Error('Invalid phone number format');
    }
    this._phoneNumber = phoneNumber;
    this._updatedAt = new Date();
  }

  updateDateOfBirth(dateOfBirth: Date): void {
    if (dateOfBirth > new Date()) {
      throw new Error('Date of birth cannot be in the future');
    }
    this._dateOfBirth = dateOfBirth;
    this._updatedAt = new Date();
  }

  updateTimezone(timezone: string): void {
    this._timezone = timezone;
    this._updatedAt = new Date();
  }

  updateLocale(locale: string): void {
    this._locale = locale;
    this._updatedAt = new Date();
  }

  updateSocialLinks(links: Partial<SocialLinks>): void {
    this._socialLinks = {
      ...this._socialLinks,
      ...links,
    };
    this._updatedAt = new Date();
  }

  updatePreferences(preferences: Partial<UserPreferences>): void {
    this._preferences = {
      ...this._preferences,
      ...preferences,
    };
    this._updatedAt = new Date();
  }
}
