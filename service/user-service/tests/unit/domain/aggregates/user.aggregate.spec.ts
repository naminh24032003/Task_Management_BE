/**
 * Unit Tests for User Aggregate Root
 * Tests business logic, domain events, and state transitions
 */

import { User, UserStatus, CreateUserProps } from '../../../../src/domain/aggregates/user.aggregate';
import { PasswordMismatchError } from '../../../../src/domain/errors/password-mismatch.error';
import { InvalidStatusTransitionError } from '../../../../src/domain/errors/invalid-status-transition.error';
import { UserCreatedEvent } from '../../../../src/domain/events/user-created.event';
import { UserEmailChangedEvent } from '../../../../src/domain/events/user-email-changed.event';
import { UserPasswordChangedEvent } from '../../../../src/domain/events/user-password-changed.event';
import { UserActivatedEvent } from '../../../../src/domain/events/user-activated.event';
import { UserDeactivatedEvent } from '../../../../src/domain/events/user-deactivated.event';
import { UserSuspendedEvent } from '../../../../src/domain/events/user-suspended.event';
import { UserDeletedEvent } from '../../../../src/domain/events/user-deleted.event';
import { UserRoleAddedEvent } from '../../../../src/domain/events/user-role-added.event';
import { UserRoleRemovedEvent } from '../../../../src/domain/events/user-role-removed.event';
import { UserProfileUpdatedEvent } from '../../../../src/domain/events/user-profile-updated.event';
import { UserLoggedInEvent } from '../../../../src/domain/events/user-logged-in.event';
import {
    createTestUser,
    createReconstitutedUser,
    createOAuthUser,
    VALID_PASSWORD,
    DEFAULT_TENANT_ID,
} from '../../../factories/user.factory';

describe('User Aggregate', () => {
    describe('create', () => {
        it('should create a new user with valid props', () => {
            const user = createTestUser();

            expect(user).toBeInstanceOf(User);
            expect(user.id).toBeDefined();
            expect(user.tenantId).toBe(DEFAULT_TENANT_ID);
            expect(user.email.toString()).toBe('test@example.com');
            expect(user.firstName).toBe('John');
            expect(user.lastName).toBe('Doe');
            expect(user.displayName).toBe('John Doe');
            expect(user.status).toBe(UserStatus.ACTIVE);
            expect(user.roleIds).toEqual([]);
        });

        it('should generate default displayName from firstName and lastName', () => {
            const user = createTestUser({ displayName: undefined });

            expect(user.displayName).toBe('John Doe');
        });

        it('should trim whitespace from names', () => {
            const user = createTestUser({
                firstName: '  John  ',
                lastName: '  Doe  ',
            });

            expect(user.firstName).toBe('John');
            expect(user.lastName).toBe('Doe');
        });

        it('should emit UserCreatedEvent', () => {
            const user = createTestUser();
            const events = user.domainEvents;

            expect(events).toHaveLength(1);
            expect(events[0]).toBeInstanceOf(UserCreatedEvent);
        });

        it('should set createdAt and updatedAt', () => {
            const beforeCreate = new Date();
            const user = createTestUser();
            const afterCreate = new Date();

            expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
            expect(user.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
            expect(user.updatedAt.getTime()).toBe(user.createdAt.getTime());
        });

        it('should set roleIds if provided', () => {
            const user = createTestUser({ roleIds: ['role-1', 'role-2'] });

            expect(user.roleIds).toEqual(['role-1', 'role-2']);
        });
    });

    describe('createOAuthUser', () => {
        it('should create OAuth user without password', () => {
            const user = createOAuthUser();

            expect(user).toBeInstanceOf(User);
            expect(user.isOAuthUser()).toBe(true);
            expect(user.provider).toBe('google');
            expect(user.providerId).toBe('google-123456');
        });

        it('should emit UserCreatedEvent for OAuth user', () => {
            const user = createOAuthUser();
            const events = user.domainEvents;

            expect(events).toHaveLength(1);
            expect(events[0]).toBeInstanceOf(UserCreatedEvent);
        });
    });

    describe('reconstitute', () => {
        it('should reconstitute user from persistence', () => {
            const user = createReconstitutedUser({
                status: UserStatus.SUSPENDED,
                roleIds: ['role-1'],
            });

            expect(user.id.toString()).toBe('507f1f77bcf86cd799439011');
            expect(user.status).toBe(UserStatus.SUSPENDED);
            expect(user.roleIds).toEqual(['role-1']);
        });

        it('should not emit any domain events when reconstituting', () => {
            const user = createReconstitutedUser();

            expect(user.domainEvents).toHaveLength(0);
        });
    });

    describe('verifyPassword', () => {
        it('should return true for correct password', () => {
            const user = createTestUser();

            expect(user.verifyPassword(VALID_PASSWORD)).toBe(true);
        });

        it('should return false for incorrect password', () => {
            const user = createTestUser();

            expect(user.verifyPassword('WrongPass123!')).toBe(false);
        });
    });

    describe('changePassword', () => {
        it('should change password with valid current password', () => {
            const user = createTestUser();
            const newPassword = 'NewSecurePass123!';

            user.changePassword(VALID_PASSWORD, newPassword);

            expect(user.verifyPassword(newPassword)).toBe(true);
            expect(user.verifyPassword(VALID_PASSWORD)).toBe(false);
        });

        it('should emit UserPasswordChangedEvent', () => {
            const user = createTestUser();
            user.clearDomainEvents();

            user.changePassword(VALID_PASSWORD, 'NewSecurePass123!');

            const events = user.domainEvents;
            expect(events).toHaveLength(1);
            expect(events[0]).toBeInstanceOf(UserPasswordChangedEvent);
        });

        it('should throw PasswordMismatchError for wrong current password', () => {
            const user = createTestUser();

            expect(() => user.changePassword('WrongPass123!', 'NewSecurePass123!')).toThrow(
                PasswordMismatchError,
            );
        });

        it('should update updatedAt timestamp', () => {
            const user = createTestUser();
            const originalUpdatedAt = user.updatedAt;

            // Wait a bit to ensure time difference
            jest.advanceTimersByTime(100);
            user.changePassword(VALID_PASSWORD, 'NewSecurePass123!');

            expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
        });
    });

    describe('changeEmail', () => {
        it('should change email', () => {
            const user = createTestUser();

            user.changeEmail('newemail@example.com');

            expect(user.email.toString()).toBe('newemail@example.com');
        });

        it('should emit UserEmailChangedEvent', () => {
            const user = createTestUser();
            user.clearDomainEvents();

            user.changeEmail('newemail@example.com');

            const events = user.domainEvents;
            expect(events).toHaveLength(1);
            expect(events[0]).toBeInstanceOf(UserEmailChangedEvent);
        });

        it('should not emit event if email is the same', () => {
            const user = createTestUser({ email: 'test@example.com' });
            user.clearDomainEvents();

            user.changeEmail('test@example.com');

            expect(user.domainEvents).toHaveLength(0);
        });

        it('should normalize new email', () => {
            const user = createTestUser();

            user.changeEmail('NEW@EXAMPLE.COM');

            expect(user.email.toString()).toBe('new@example.com');
        });
    });

    describe('updateProfile', () => {
        it('should update firstName', () => {
            const user = createTestUser();

            user.updateProfile({ firstName: 'Jane' });

            expect(user.firstName).toBe('Jane');
        });

        it('should update lastName', () => {
            const user = createTestUser();

            user.updateProfile({ lastName: 'Smith' });

            expect(user.lastName).toBe('Smith');
        });

        it('should update displayName', () => {
            const user = createTestUser();

            user.updateProfile({ displayName: 'Johnny' });

            expect(user.displayName).toBe('Johnny');
        });

        it('should update multiple fields at once', () => {
            const user = createTestUser();

            user.updateProfile({
                firstName: 'Jane',
                lastName: 'Smith',
                displayName: 'J. Smith',
            });

            expect(user.firstName).toBe('Jane');
            expect(user.lastName).toBe('Smith');
            expect(user.displayName).toBe('J. Smith');
        });

        it('should emit UserProfileUpdatedEvent with updated fields', () => {
            const user = createTestUser();
            user.clearDomainEvents();

            user.updateProfile({ firstName: 'Jane', lastName: 'Smith' });

            const events = user.domainEvents;
            expect(events).toHaveLength(1);
            expect(events[0]).toBeInstanceOf(UserProfileUpdatedEvent);
        });

        it('should not emit event when no fields updated', () => {
            const user = createTestUser();
            user.clearDomainEvents();

            user.updateProfile({});

            expect(user.domainEvents).toHaveLength(0);
        });

        it('should trim whitespace from values', () => {
            const user = createTestUser();

            user.updateProfile({ firstName: '  Jane  ' });

            expect(user.firstName).toBe('Jane');
        });
    });

    describe('recordLogin', () => {
        it('should record login with ip and user agent', () => {
            const user = createTestUser();
            const beforeLogin = new Date();

            user.recordLogin('192.168.1.1', 'Mozilla/5.0');

            expect(user.lastLoginAt).toBeDefined();
            expect(user.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
        });

        it('should emit UserLoggedInEvent', () => {
            const user = createTestUser();
            user.clearDomainEvents();

            user.recordLogin('192.168.1.1', 'Mozilla/5.0');

            const events = user.domainEvents;
            expect(events).toHaveLength(1);
            expect(events[0]).toBeInstanceOf(UserLoggedInEvent);
        });
    });

    describe('status transitions', () => {
        describe('activate', () => {
            it('should activate inactive user', () => {
                const user = createReconstitutedUser({ status: UserStatus.INACTIVE });

                user.activate();

                expect(user.status).toBe(UserStatus.ACTIVE);
            });

            it('should activate suspended user', () => {
                const user = createReconstitutedUser({ status: UserStatus.SUSPENDED });

                user.activate();

                expect(user.status).toBe(UserStatus.ACTIVE);
            });

            it('should emit UserActivatedEvent', () => {
                const user = createReconstitutedUser({ status: UserStatus.INACTIVE });

                user.activate();

                const events = user.domainEvents;
                expect(events).toHaveLength(1);
                expect(events[0]).toBeInstanceOf(UserActivatedEvent);
            });

            it('should throw when activating deleted user', () => {
                const user = createReconstitutedUser({ status: UserStatus.DELETED });

                expect(() => user.activate()).toThrow(InvalidStatusTransitionError);
            });
        });

        describe('deactivate', () => {
            it('should deactivate user', () => {
                const user = createTestUser();

                user.deactivate();

                expect(user.status).toBe(UserStatus.INACTIVE);
            });

            it('should emit UserDeactivatedEvent', () => {
                const user = createTestUser();
                user.clearDomainEvents();

                user.deactivate();

                const events = user.domainEvents;
                expect(events).toHaveLength(1);
                expect(events[0]).toBeInstanceOf(UserDeactivatedEvent);
            });
        });

        describe('suspend', () => {
            it('should suspend user', () => {
                const user = createTestUser();

                user.suspend('Violation of terms');

                expect(user.status).toBe(UserStatus.SUSPENDED);
            });

            it('should emit UserSuspendedEvent', () => {
                const user = createTestUser();
                user.clearDomainEvents();

                user.suspend('Violation');

                const events = user.domainEvents;
                expect(events).toHaveLength(1);
                expect(events[0]).toBeInstanceOf(UserSuspendedEvent);
            });
        });

        describe('delete', () => {
            it('should soft delete user', () => {
                const user = createTestUser();

                user.delete();

                expect(user.status).toBe(UserStatus.DELETED);
            });

            it('should emit UserDeletedEvent', () => {
                const user = createTestUser();
                user.clearDomainEvents();

                user.delete();

                const events = user.domainEvents;
                expect(events).toHaveLength(1);
                expect(events[0]).toBeInstanceOf(UserDeletedEvent);
            });
        });
    });

    describe('role management', () => {
        describe('addRole', () => {
            it('should add role to user', () => {
                const user = createTestUser();

                user.addRole('admin-role');

                expect(user.roleIds).toContain('admin-role');
            });

            it('should emit UserRoleAddedEvent', () => {
                const user = createTestUser();
                user.clearDomainEvents();

                user.addRole('admin-role');

                const events = user.domainEvents;
                expect(events).toHaveLength(1);
                expect(events[0]).toBeInstanceOf(UserRoleAddedEvent);
            });

            it('should not add duplicate role', () => {
                const user = createTestUser({ roleIds: ['existing-role'] });
                user.clearDomainEvents();

                user.addRole('existing-role');

                expect(user.roleIds.filter((r) => r === 'existing-role')).toHaveLength(1);
                expect(user.domainEvents).toHaveLength(0);
            });
        });

        describe('removeRole', () => {
            it('should remove role from user', () => {
                const user = createTestUser({ roleIds: ['role-to-remove'] });

                user.removeRole('role-to-remove');

                expect(user.roleIds).not.toContain('role-to-remove');
            });

            it('should emit UserRoleRemovedEvent', () => {
                const user = createTestUser({ roleIds: ['role-to-remove'] });
                user.clearDomainEvents();

                user.removeRole('role-to-remove');

                const events = user.domainEvents;
                expect(events).toHaveLength(1);
                expect(events[0]).toBeInstanceOf(UserRoleRemovedEvent);
            });

            it('should not emit event when removing non-existent role', () => {
                const user = createTestUser();
                user.clearDomainEvents();

                user.removeRole('non-existent-role');

                expect(user.domainEvents).toHaveLength(0);
            });
        });
    });

    describe('clearDomainEvents', () => {
        it('should clear all domain events', () => {
            const user = createTestUser();
            expect(user.domainEvents.length).toBeGreaterThan(0);

            user.clearDomainEvents();

            expect(user.domainEvents).toHaveLength(0);
        });
    });

    describe('isActive', () => {
        it('should return true for active user', () => {
            const user = createTestUser();

            expect(user.isActive()).toBe(true);
        });

        it('should return false for inactive user', () => {
            const user = createReconstitutedUser({ status: UserStatus.INACTIVE });

            expect(user.isActive()).toBe(false);
        });

        it('should return false for suspended user', () => {
            const user = createReconstitutedUser({ status: UserStatus.SUSPENDED });

            expect(user.isActive()).toBe(false);
        });

        it('should return false for deleted user', () => {
            const user = createReconstitutedUser({ status: UserStatus.DELETED });

            expect(user.isActive()).toBe(false);
        });
    });

    describe('isOAuthUser', () => {
        it('should return true for OAuth user', () => {
            const user = createOAuthUser();

            expect(user.isOAuthUser()).toBe(true);
        });

        it('should return false for regular user', () => {
            const user = createTestUser();

            expect(user.isOAuthUser()).toBe(false);
        });
    });

    describe('getPasswordHash and getPasswordSalt', () => {
        it('should return password hash', () => {
            const user = createTestUser();

            expect(user.getPasswordHash()).toBeDefined();
            expect(typeof user.getPasswordHash()).toBe('string');
        });

        it('should return password salt', () => {
            const user = createTestUser();

            expect(user.getPasswordSalt()).toBeDefined();
            expect(typeof user.getPasswordSalt()).toBe('string');
        });
    });

    describe('roleIds getter', () => {
        it('should return a copy of roleIds array', () => {
            const user = createTestUser({ roleIds: ['role-1'] });
            const roleIds = user.roleIds;

            roleIds.push('modified-role');

            expect(user.roleIds).not.toContain('modified-role');
        });
    });

    describe('domainEvents getter', () => {
        it('should return a copy of domainEvents array', () => {
            const user = createTestUser();
            const events = user.domainEvents;
            const originalLength = events.length;

            events.pop();

            expect(user.domainEvents).toHaveLength(originalLength);
        });
    });
});
