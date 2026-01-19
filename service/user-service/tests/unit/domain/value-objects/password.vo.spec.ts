/**
 * Unit Tests for Password Value Object
 * Tests password creation, hashing, verification and validation
 */

import { Password } from '../../../../src/domain/value-objects/password.vo';
import { WeakPasswordError } from '../../../../src/domain/errors/weak-password.error';

describe('Password Value Object', () => {
    // Valid passwords meeting all requirements
    const validPasswords = [
        'SecurePass123!',
        'MyP@ssword1',
        'Test123!@#',
        'Abcdefgh1!',
        'LongP@ssw0rdWithManyCharacters!',
    ];

    describe('create', () => {
        describe('valid passwords', () => {
            it.each(validPasswords)('should create password for: %s', (password) => {
                const result = Password.create(password);

                expect(result).toBeInstanceOf(Password);
                expect(result.getHash()).toBeDefined();
                expect(result.getSalt()).toBeDefined();
            });

            it('should generate different salt and hash each time', () => {
                const password1 = Password.create('SecurePass123!');
                const password2 = Password.create('SecurePass123!');

                expect(password1.getHash()).not.toBe(password2.getHash());
                expect(password1.getSalt()).not.toBe(password2.getSalt());
            });
        });

        describe('password length validation', () => {
            it('should throw if password is less than 8 characters', () => {
                expect(() => Password.create('Short1!')).toThrow(WeakPasswordError);
                expect(() => Password.create('Abc12!')).toThrow('at least 8 characters');
            });

            it('should throw if password exceeds 128 characters', () => {
                const longPassword = 'Aa1!' + 'x'.repeat(126);

                expect(() => Password.create(longPassword)).toThrow(WeakPasswordError);
                expect(() => Password.create(longPassword)).toThrow('at most 128 characters');
            });

            it('should throw if password is empty', () => {
                expect(() => Password.create('')).toThrow(WeakPasswordError);
            });

            it('should throw if password is null or undefined', () => {
                expect(() => Password.create(null as any)).toThrow();
                expect(() => Password.create(undefined as any)).toThrow();
            });
        });

        describe('password complexity validation', () => {
            it('should throw if no uppercase letter', () => {
                expect(() => Password.create('lowercase123!')).toThrow(WeakPasswordError);
                expect(() => Password.create('lowercase123!')).toThrow('uppercase letter');
            });

            it('should throw if no lowercase letter', () => {
                expect(() => Password.create('UPPERCASE123!')).toThrow(WeakPasswordError);
                expect(() => Password.create('UPPERCASE123!')).toThrow('lowercase letter');
            });

            it('should throw if no number', () => {
                expect(() => Password.create('NoNumbers!@#')).toThrow(WeakPasswordError);
                expect(() => Password.create('NoNumbers!@#')).toThrow('number');
            });

            it('should throw if no special character', () => {
                expect(() => Password.create('NoSpecialChar123')).toThrow(WeakPasswordError);
                expect(() => Password.create('NoSpecialChar123')).toThrow('special character');
            });
        });
    });

    describe('fromHash', () => {
        it('should reconstitute password from hash and salt', () => {
            const hash = 'existinghash123';
            const salt = 'existingsalt456';

            const password = Password.fromHash(hash, salt);

            expect(password.getHash()).toBe(hash);
            expect(password.getSalt()).toBe(salt);
        });
    });

    describe('createEmpty', () => {
        it('should create empty password for OAuth users', () => {
            const password = Password.createEmpty();

            expect(password.isOAuthUser()).toBe(true);
            expect(password.getHash()).toBe('OAUTH_USER_NO_PASSWORD');
        });
    });

    describe('verify', () => {
        it('should return true for correct password', () => {
            const plainPassword = 'SecurePass123!';
            const password = Password.create(plainPassword);

            expect(password.verify(plainPassword)).toBe(true);
        });

        it('should return false for incorrect password', () => {
            const password = Password.create('SecurePass123!');

            expect(password.verify('WrongPassword123!')).toBe(false);
        });

        it('should be case sensitive', () => {
            const password = Password.create('SecurePass123!');

            expect(password.verify('securepass123!')).toBe(false);
            expect(password.verify('SECUREPASS123!')).toBe(false);
        });
    });

    describe('isOAuthUser', () => {
        it('should return true for empty password', () => {
            const password = Password.createEmpty();

            expect(password.isOAuthUser()).toBe(true);
        });

        it('should return false for regular password', () => {
            const password = Password.create('SecurePass123!');

            expect(password.isOAuthUser()).toBe(false);
        });
    });

    describe('getHash', () => {
        it('should return the hashed value', () => {
            const password = Password.create('SecurePass123!');

            expect(password.getHash()).toBeDefined();
            expect(typeof password.getHash()).toBe('string');
            expect(password.getHash().length).toBeGreaterThan(0);
        });
    });

    describe('getSalt', () => {
        it('should return the salt value', () => {
            const password = Password.create('SecurePass123!');

            expect(password.getSalt()).toBeDefined();
            expect(typeof password.getSalt()).toBe('string');
            expect(password.getSalt().length).toBeGreaterThan(0);
        });
    });

    describe('immutability', () => {
        it('should be frozen and immutable', () => {
            const password = Password.create('SecurePass123!');

            expect(Object.isFrozen(password)).toBe(true);
        });
    });
});
