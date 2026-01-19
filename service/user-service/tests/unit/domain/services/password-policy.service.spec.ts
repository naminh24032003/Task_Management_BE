/**
 * Unit Tests for PasswordPolicyService Domain Service
 * Tests password validation policies and strength calculation
 */

import { PasswordPolicyService } from '../../../../src/domain/services/password-policy.service';
import { WeakPasswordError } from '../../../../src/domain/errors/weak-password.error';

describe('PasswordPolicyService', () => {
    let policyService: PasswordPolicyService;

    beforeEach(() => {
        policyService = new PasswordPolicyService();
    });

    describe('constructor', () => {
        it('should use default configuration when no config provided', () => {
            const config = policyService.getConfig();

            expect(config.minLength).toBe(8);
            expect(config.maxLength).toBe(128);
            expect(config.requireUppercase).toBe(true);
            expect(config.requireLowercase).toBe(true);
            expect(config.requireDigit).toBe(true);
            expect(config.requireSpecialChar).toBe(true);
        });

        it('should accept custom configuration', () => {
            const customPolicy = new PasswordPolicyService({
                minLength: 12,
                maxLength: 64,
                requireUppercase: false,
            });

            const config = customPolicy.getConfig();
            expect(config.minLength).toBe(12);
            expect(config.maxLength).toBe(64);
            expect(config.requireUppercase).toBe(false);
        });
    });

    describe('validate', () => {
        describe('length validation', () => {
            it('should fail for password shorter than minLength', () => {
                const result = policyService.validate('Short1!');

                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must be at least 8 characters');
            });

            it('should fail for password longer than maxLength', () => {
                const longPassword = 'Aa1!' + 'x'.repeat(130);
                const result = policyService.validate(longPassword);

                expect(result.isValid).toBe(false);
                expect(result.errors.some((e) => e.includes('cannot exceed'))).toBe(true);
            });

            it('should pass for password within length limits', () => {
                const result = policyService.validate('ValidPass123!');

                expect(result.errors.filter((e) => e.includes('characters'))).toHaveLength(0);
            });
        });

        describe('uppercase validation', () => {
            it('should fail if no uppercase letter', () => {
                const result = policyService.validate('lowercase123!');

                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must contain at least one uppercase letter');
            });

            it('should pass with uppercase letter', () => {
                const result = policyService.validate('Uppercase123!');

                expect(result.errors.filter((e) => e.includes('uppercase'))).toHaveLength(0);
            });
        });

        describe('lowercase validation', () => {
            it('should fail if no lowercase letter', () => {
                const result = policyService.validate('UPPERCASE123!');

                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must contain at least one lowercase letter');
            });

            it('should pass with lowercase letter', () => {
                const result = policyService.validate('Lowercase123!');

                expect(result.errors.filter((e) => e.includes('lowercase'))).toHaveLength(0);
            });
        });

        describe('digit validation', () => {
            it('should fail if no digit', () => {
                const result = policyService.validate('NoDigitHere!');

                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must contain at least one digit');
            });

            it('should pass with digit', () => {
                const result = policyService.validate('HasDigit1!');

                expect(result.errors.filter((e) => e.includes('digit'))).toHaveLength(0);
            });
        });

        describe('special character validation', () => {
            it('should fail if no special character', () => {
                const result = policyService.validate('NoSpecial123');

                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must contain at least one special character');
            });

            it('should pass with special character', () => {
                const result = policyService.validate('HasSpecial123!');

                expect(result.errors.filter((e) => e.includes('special'))).toHaveLength(0);
            });

            it('should accept various special characters', () => {
                const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'];

                for (const char of specialChars) {
                    const result = policyService.validate(`Password1${char}`);
                    expect(result.errors.filter((e) => e.includes('special'))).toHaveLength(0);
                }
            });
        });

        describe('common password validation', () => {
            it('should fail for common passwords', () => {
                const commonPasswords = ['password', '123456', 'qwerty', 'admin'];

                for (const password of commonPasswords) {
                    const result = policyService.validate(password);
                    expect(result.errors).toContain('Password is too common');
                }
            });
        });

        describe('user info validation', () => {
            it('should fail if password contains email local part', () => {
                const result = policyService.validate('johnsmith123!A', {
                    email: 'johnsmith@example.com',
                });

                expect(result.errors).toContain('Password cannot contain personal information');
            });

            it('should fail if password contains first name', () => {
                const result = policyService.validate('JohnTest123!', {
                    firstName: 'John',
                });

                expect(result.errors).toContain('Password cannot contain personal information');
            });

            it('should fail if password contains last name', () => {
                const result = policyService.validate('TestSmith123!', {
                    lastName: 'Smith',
                });

                expect(result.errors).toContain('Password cannot contain personal information');
            });

            it('should ignore short names (less than 3 characters)', () => {
                const result = policyService.validate('ValidPass123!', {
                    firstName: 'Jo',
                });

                expect(result.errors.filter((e) => e.includes('personal'))).toHaveLength(0);
            });
        });

        describe('consecutive characters validation', () => {
            it('should fail for too many consecutive identical characters', () => {
                const result = policyService.validate('Passsssword1!');

                expect(result.errors.some((e) => e.includes('consecutive'))).toBe(true);
            });

            it('should pass for allowed consecutive characters', () => {
                const result = policyService.validate('Passsword123!'); // 3 s's, allowed

                expect(result.errors.filter((e) => e.includes('consecutive'))).toHaveLength(0);
            });
        });

        describe('password strength scoring', () => {
            it('should calculate weak strength for poor password', () => {
                const customPolicy = new PasswordPolicyService({
                    requireUppercase: false,
                    requireLowercase: false,
                    requireDigit: false,
                    requireSpecialChar: false,
                    preventCommonPasswords: false,
                });

                const result = customPolicy.validate('abc');

                expect(result.strength).toBe('weak');
                expect(result.score).toBeLessThan(40);
            });

            it('should calculate strong strength for excellent password', () => {
                const result = policyService.validate('MyVeryStr0ng&SecureP@ssword!');

                expect(result.strength).toBe('strong');
                expect(result.score).toBeGreaterThanOrEqual(80);
            });

            it('should give bonus for longer passwords', () => {
                const shortResult = policyService.validate('Short1!A');
                const longResult = policyService.validate('VeryLongPassword1!');

                expect(longResult.score).toBeGreaterThan(shortResult.score);
            });
        });

        describe('valid passwords', () => {
            const validPasswords = [
                'SecurePass123!',
                'MyP@ssword1',
                'Test123!@#',
                'Abcdefgh1!',
                'LongP@ssw0rd!',
            ];

            it.each(validPasswords)('should pass validation for: %s', (password) => {
                const result = policyService.validate(password);

                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
        });
    });

    describe('validateOrThrow', () => {
        it('should not throw for valid password', () => {
            expect(() => policyService.validateOrThrow('SecurePass123!')).not.toThrow();
        });

        it('should throw WeakPasswordError for invalid password', () => {
            expect(() => policyService.validateOrThrow('weak')).toThrow(WeakPasswordError);
        });

        it('should include all errors in thrown exception', () => {
            try {
                policyService.validateOrThrow('weak');
                fail('Should have thrown');
            } catch (error) {
                expect((error as WeakPasswordError).message).toContain('at least 8 characters');
            }
        });
    });

    describe('isInHistory', () => {
        const mockHashFunction = (pwd: string) => `hashed_${pwd}`;

        it('should return true if password is in history', () => {
            const history = ['hashed_oldpassword1', 'hashed_oldpassword2'];

            const result = policyService.isInHistory('oldpassword1', history, mockHashFunction);

            expect(result).toBe(true);
        });

        it('should return false if password is not in history', () => {
            const history = ['hashed_oldpassword1', 'hashed_oldpassword2'];

            const result = policyService.isInHistory('newpassword', history, mockHashFunction);

            expect(result).toBe(false);
        });

        it('should only check up to passwordHistoryCount entries', () => {
            const policyWith3History = new PasswordPolicyService({ passwordHistoryCount: 3 });
            const history = [
                'hashed_old1',
                'hashed_old2',
                'hashed_old3',
                'hashed_old4',
                'hashed_old5',
            ];

            // old4 and old5 should not be checked
            const result = policyWith3History.isInHistory('old4', history, mockHashFunction);

            expect(result).toBe(false);
        });
    });

    describe('isExpired', () => {
        it('should return true if password is expired', () => {
            const policy = new PasswordPolicyService({ expirationDays: 30 });
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 31);

            const result = policy.isExpired(oldDate);

            expect(result).toBe(true);
        });

        it('should return false if password is not expired', () => {
            const policy = new PasswordPolicyService({ expirationDays: 30 });
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 15);

            const result = policy.isExpired(recentDate);

            expect(result).toBe(false);
        });

        it('should return false if expiration is disabled (0 days)', () => {
            const policy = new PasswordPolicyService({ expirationDays: 0 });
            const veryOldDate = new Date('2000-01-01');

            const result = policy.isExpired(veryOldDate);

            expect(result).toBe(false);
        });
    });

    describe('getDaysUntilExpiration', () => {
        it('should return remaining days until expiration', () => {
            const policy = new PasswordPolicyService({ expirationDays: 90 });
            const changedDate = new Date();
            changedDate.setDate(changedDate.getDate() - 30);

            const result = policy.getDaysUntilExpiration(changedDate);

            expect(result).toBeCloseTo(60, 0);
        });

        it('should return 0 if already expired', () => {
            const policy = new PasswordPolicyService({ expirationDays: 30 });
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 60);

            const result = policy.getDaysUntilExpiration(oldDate);

            expect(result).toBe(0);
        });

        it('should return Infinity if expiration is disabled', () => {
            const policy = new PasswordPolicyService({ expirationDays: 0 });

            const result = policy.getDaysUntilExpiration(new Date());

            expect(result).toBe(Infinity);
        });
    });

    describe('getRequirementsMessage', () => {
        it('should return formatted requirements message', () => {
            const message = policyService.getRequirementsMessage();

            expect(message).toContain('Password requirements:');
            expect(message).toContain('8-128 characters');
            expect(message).toContain('uppercase');
            expect(message).toContain('lowercase');
            expect(message).toContain('digit');
            expect(message).toContain('special character');
        });

        it('should respect custom configuration in message', () => {
            const customPolicy = new PasswordPolicyService({
                minLength: 12,
                maxLength: 50,
                requireUppercase: false,
            });

            const message = customPolicy.getRequirementsMessage();

            expect(message).toContain('12-50 characters');
            expect(message).not.toContain('uppercase');
        });
    });

    describe('getConfig', () => {
        it('should return a copy of the configuration', () => {
            const config = policyService.getConfig();
            config.minLength = 999;

            expect(policyService.getConfig().minLength).toBe(8);
        });
    });
});
