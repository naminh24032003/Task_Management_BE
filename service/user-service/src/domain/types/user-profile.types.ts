/**
 * User Profile Types
 * Domain interfaces for UserProfile entity
 */

export interface UserProfileProps {
  userId: string;
  tenantId: string;
  avatar?: string;
  bio?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  timezone?: string;
  locale?: string;
  socialLinks?: SocialLinks;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialLinks {
  linkedin?: string;
  twitter?: string;
  github?: string;
  website?: string;
}

export interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
}
