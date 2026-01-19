/**
 * Unit Tests for Email Value Object
 * Tests validation, creation, and behavior of the Email VO
 */

import { Email } from '../../../../src/domain/value-objects/email.vo';
import { InvalidEmailError } from '../../../../src/domain/errors/invalid-email.error';

describe('Email Value Object', () => {
    describe('create', () => {
        describe('valid emails', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.com',
                'user+tag@example.org',
                'a@b.co',
                'test123@test-domain.com',
                'TEST@EXAMPLE.COM',
                ' test@example.com ', // with whitespace
            ];

            it.each(validEmails)('should create Email for: %s', (email) => {
                const result = Email.create(email);

                expect(result).toBeInstanceOf(Email);
                expect(result.toString()).toBe(email.trim().toLowerCase());
            });
        });

        describe('invalid emails', () => {
            const invalidEmails = [
                ['', 'empty string'],
                ['   ', 'whitespace only'],
                ['invalid', 'no @ symbol'],
                ['@example.com', 'no local part'],
                ['test@', 'no domain'],
                ['test@.com', 'domain starts with dot'],
                ['test.example.com', 'no @ symbol'],
                ['test@domain', 'no TLD'],
                ['test user@example.com', 'space in local part'],
            ];

            it.each(invalidEmails)('should throw InvalidEmailError for: %s (%s)', (email) => {
                expect(() => Email.create(email as string)).toThrow(InvalidEmailError);
            });
        });

        it('should throw if email exceeds 255 characters', () => {
            const longEmail = 'a'.repeat(250) + '@example.com';

            expect(() => Email.create(longEmail)).toThrow(InvalidEmailError);
            expect(() => Email.create(longEmail)).toThrow('too long');
        });

        it('should throw if email is null or undefined', () => {
            expect(() => Email.create(null as any)).toThrow(InvalidEmailError);
            expect(() => Email.create(undefined as any)).toThrow(InvalidEmailError);
        });
    });

    describe('normalization', () => {
        it('should normalize email to lowercase', () => {
            const email = Email.create('TEST@EXAMPLE.COM');

            expect(email.toString()).toBe('test@example.com');
        });

        it('should trim whitespace', () => {
            const email = Email.create('  test@example.com  ');

            expect(email.toString()).toBe('test@example.com');
        });
    });

    describe('toString', () => {
        it('should return the email value', () => {
            const email = Email.create('user@example.com');

            expect(email.toString()).toBe('user@example.com');
        });
    });

    describe('equals', () => {
        it('should return true for emails with same value', () => {
            const email1 = Email.create('test@example.com');
            const email2 = Email.create('test@example.com');

            expect(email1.equals(email2)).toBe(true);
        });

        it('should return true for same email with different case', () => {
            const email1 = Email.create('TEST@example.com');
            const email2 = Email.create('test@EXAMPLE.com');

            expect(email1.equals(email2)).toBe(true);
        });

        it('should return false for different emails', () => {
            const email1 = Email.create('user1@example.com');
            const email2 = Email.create('user2@example.com');

            expect(email1.equals(email2)).toBe(false);
        });
    });

    describe('getDomain', () => {
        it('should return the domain part of the email', () => {
            const email = Email.create('user@example.com');

            expect(email.getDomain()).toBe('example.com');
        });

        it('should handle complex domains', () => {
            const email = Email.create('user@mail.subdomain.example.co.uk');

            expect(email.getDomain()).toBe('mail.subdomain.example.co.uk');
        });
    });

    describe('getLocalPart', () => {
        it('should return the local part of the email', () => {
            const email = Email.create('user.name@example.com');

            expect(email.getLocalPart()).toBe('user.name');
        });

        it('should handle complex local parts', () => {
            const email = Email.create('user+tag.name123@example.com');

            expect(email.getLocalPart()).toBe('user+tag.name123');
        });
    });

    describe('immutability', () => {
        it('should be frozen and immutable', () => {
            const email = Email.create('test@example.com');

            expect(Object.isFrozen(email)).toBe(true);
        });
    });
});
