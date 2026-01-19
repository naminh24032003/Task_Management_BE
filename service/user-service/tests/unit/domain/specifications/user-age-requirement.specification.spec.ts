/**
 * Unit Tests for UserAgeRequirementSpecification
 */

import { AgeSpecifications } from '../../../../src/domain/specifications/user-age-requirement.specification';
import { UserProfile } from '../../../../src/domain/entities/user-profile.entity';

describe('User Age Specifications', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    // Helper to create profile with specific age
    const createProfileWithAge = (age: number) => {
        const profile = UserProfile.create(userId, tenantId);
        const dob = new Date();
        dob.setFullYear(dob.getFullYear() - age);
        // Ensure birthdays today or in the past to make age calculation stable
        dob.setDate(dob.getDate() - 1);
        profile.updateDateOfBirth(dob);
        return profile;
    };

    describe('UserAgeRequirementSpecification (Minimum Age)', () => {
        const spec = AgeSpecifications.minimumAge(18);

        it('should return true if user meets minimum age', () => {
            const profile = createProfileWithAge(20);
            expect(spec.isSatisfiedBy(profile)).toBe(true);
        });

        it('should return true if user is exactly the minimum age', () => {
            const profile = createProfileWithAge(18);
            expect(spec.isSatisfiedBy(profile)).toBe(true);
        });

        it('should return false if user is younger than minimum age', () => {
            const profile = createProfileWithAge(17);
            expect(spec.isSatisfiedBy(profile)).toBe(false);
        });

        it('should return false if date of birth is not set', () => {
            const profile = UserProfile.create(userId, tenantId);
            expect(spec.isSatisfiedBy(profile)).toBe(false);
        });

        it('should throw error for negative minimum age', () => {
            expect(() => AgeSpecifications.minimumAge(-1)).toThrow('Minimum age cannot be negative');
        });
    });

    describe('UserMaximumAgeSpecification', () => {
        const spec = AgeSpecifications.maximumAge(65);

        it('should return true if user is below maximum age', () => {
            const profile = createProfileWithAge(30);
            expect(spec.isSatisfiedBy(profile)).toBe(true);
        });

        it('should return true if user is exactly the maximum age', () => {
            const profile = createProfileWithAge(65);
            expect(spec.isSatisfiedBy(profile)).toBe(true);
        });

        it('should return false if user is older than maximum age', () => {
            const profile = createProfileWithAge(70);
            expect(spec.isSatisfiedBy(profile)).toBe(false);
        });

        it('should return true if date of birth is not set (assumes valid)', () => {
            const profile = UserProfile.create(userId, tenantId);
            expect(spec.isSatisfiedBy(profile)).toBe(true);
        });
    });

    describe('UserAgeRangeSpecification', () => {
        const spec = AgeSpecifications.ageRange(18, 30);

        it('should return true if age is within range', () => {
            expect(spec.isSatisfiedBy(createProfileWithAge(25))).toBe(true);
            expect(spec.isSatisfiedBy(createProfileWithAge(18))).toBe(true);
            expect(spec.isSatisfiedBy(createProfileWithAge(30))).toBe(true);
        });

        it('should return false if age is outside range', () => {
            expect(spec.isSatisfiedBy(createProfileWithAge(17))).toBe(false);
            expect(spec.isSatisfiedBy(createProfileWithAge(31))).toBe(false);
        });

        it('should throw error if minAge > maxAge', () => {
            expect(() => AgeSpecifications.ageRange(30, 20)).toThrow();
        });
    });

    describe('UserIsAdultSpecification', () => {
        const spec = AgeSpecifications.isAdult();

        it('should verify user is 18+', () => {
            expect(spec.isSatisfiedBy(createProfileWithAge(18))).toBe(true);
            expect(spec.isSatisfiedBy(createProfileWithAge(17))).toBe(false);
        });
    });

    describe('UserIsMinorSpecification', () => {
        const spec = AgeSpecifications.isMinor();

        it('should verify user is under 18', () => {
            expect(spec.isSatisfiedBy(createProfileWithAge(17))).toBe(true);
            expect(spec.isSatisfiedBy(createProfileWithAge(18))).toBe(false);
        });

        it('should return false if age cannot be determined', () => {
            const profile = UserProfile.create(userId, tenantId);
            expect(spec.isSatisfiedBy(profile)).toBe(false);
        });
    });

    describe('UserHasDateOfBirthSpecification', () => {
        const spec = AgeSpecifications.hasDateOfBirth();

        it('should return true if DOB is set', () => {
            const profile = createProfileWithAge(20);
            expect(spec.isSatisfiedBy(profile)).toBe(true);
        });

        it('should return false if DOB is not set', () => {
            const profile = UserProfile.create(userId, tenantId);
            expect(spec.isSatisfiedBy(profile)).toBe(false);
        });
    });
});
