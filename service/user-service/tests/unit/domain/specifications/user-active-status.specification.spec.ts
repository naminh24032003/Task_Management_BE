/**
 * Unit Tests for User Status Specifications
 * Tests the specification pattern and status rules
 */

import { UserStatusSpecifications, AbstractSpecification, Specification } from '../../../../src/domain/specifications/user-active-status.specification';
import { User, UserStatus } from '../../../../src/domain/aggregates/user.aggregate';
import { createReconstitutedUser } from '../../../factories/user.factory';

describe('User Status Specifications', () => {
    const activeUser = createReconstitutedUser({ status: UserStatus.ACTIVE });
    const inactiveUser = createReconstitutedUser({ status: UserStatus.INACTIVE });
    const suspendedUser = createReconstitutedUser({ status: UserStatus.SUSPENDED });
    const deletedUser = createReconstitutedUser({ status: UserStatus.DELETED });

    describe('UserActiveStatusSpecification', () => {
        const spec = UserStatusSpecifications.isActive();

        it('should return true if user is active', () => {
            expect(spec.isSatisfiedBy(activeUser)).toBe(true);
        });

        it('should return false if user is not active', () => {
            expect(spec.isSatisfiedBy(inactiveUser)).toBe(false);
            expect(spec.isSatisfiedBy(suspendedUser)).toBe(false);
            expect(spec.isSatisfiedBy(deletedUser)).toBe(false);
        });
    });

    describe('UserInactiveStatusSpecification', () => {
        const spec = UserStatusSpecifications.isInactive();

        it('should return true if user is inactive', () => {
            expect(spec.isSatisfiedBy(inactiveUser)).toBe(true);
        });

        it('should return false if user is not inactive', () => {
            expect(spec.isSatisfiedBy(activeUser)).toBe(false);
        });
    });

    describe('UserSuspendedStatusSpecification', () => {
        const spec = UserStatusSpecifications.isSuspended();

        it('should return true if user is suspended', () => {
            expect(spec.isSatisfiedBy(suspendedUser)).toBe(true);
        });

        it('should return false if user is not suspended', () => {
            expect(spec.isSatisfiedBy(activeUser)).toBe(false);
        });
    });

    describe('Composite Specifications', () => {
        it('not() should negate the specification', () => {
            const spec = UserStatusSpecifications.isNotDeleted();
            expect(spec.isSatisfiedBy(activeUser)).toBe(true);
            expect(spec.isSatisfiedBy(deletedUser)).toBe(false);
        });

        it('or() should return true if either specification is satisfied', () => {
            const spec = UserStatusSpecifications.isActiveOrInactive();
            expect(spec.isSatisfiedBy(activeUser)).toBe(true);
            expect(spec.isSatisfiedBy(inactiveUser)).toBe(true);
            expect(spec.isSatisfiedBy(suspendedUser)).toBe(false);
        });

        it('and() should return true only if both specifications are satisfied', () => {
            // Create a dummy always true spec
            class TrueSpec extends AbstractSpecification<User> {
                isSatisfiedBy(_: User): boolean { return true; }
            }

            const isActive = UserStatusSpecifications.isActive();
            const combined = isActive.and(new TrueSpec());

            expect(combined.isSatisfiedBy(activeUser)).toBe(true);
            expect(combined.isSatisfiedBy(inactiveUser)).toBe(false);
        });
    });

    describe('UserCanLoginSpecification', () => {
        const spec = UserStatusSpecifications.canLogin();

        it('should return true if user is active', () => {
            expect(spec.isSatisfiedBy(activeUser)).toBe(true);
        });

        it('should return false if user is not active', () => {
            expect(spec.isSatisfiedBy(inactiveUser)).toBe(false);
            expect(spec.isSatisfiedBy(suspendedUser)).toBe(false);
        });
    });
});
