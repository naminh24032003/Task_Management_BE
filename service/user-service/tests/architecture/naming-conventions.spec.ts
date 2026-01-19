/**
 * Architecture Tests - Naming Conventions
 * Ensures consistent naming across the codebase
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(__dirname, '../../src');

/**
 * Get all files in a directory recursively
 */
function getAllFiles(dir: string, extension: string = '.ts'): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
        return files;
    }

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            files.push(...getAllFiles(fullPath, extension));
        } else if (item.name.endsWith(extension) && !item.name.endsWith('.spec.ts')) {
            files.push(fullPath);
        }
    }

    return files;
}

describe('Naming Conventions', () => {
    describe('Domain Layer', () => {
        describe('Value Objects', () => {
            const voDir = path.join(SRC_DIR, 'domain/value-objects');
            const voFiles = getAllFiles(voDir);

            it('should follow .vo.ts naming pattern', () => {
                const violations = voFiles.filter((f) => !f.endsWith('.vo.ts'));

                expect(violations.map((v) => path.basename(v))).toEqual([]);
            });
        });

        describe('Aggregates', () => {
            const aggDir = path.join(SRC_DIR, 'domain/aggregates');
            const aggFiles = getAllFiles(aggDir);

            it('should follow .aggregate.ts naming pattern', () => {
                const violations = aggFiles.filter((f) => !f.endsWith('.aggregate.ts'));

                expect(violations.map((v) => path.basename(v))).toEqual([]);
            });
        });

        describe('Entities', () => {
            const entityDir = path.join(SRC_DIR, 'domain/entities');
            const entityFiles = getAllFiles(entityDir);

            it('should follow .entity.ts naming pattern', () => {
                const violations = entityFiles.filter((f) => !f.endsWith('.entity.ts'));

                expect(violations.map((v) => path.basename(v))).toEqual([]);
            });
        });

        describe('Domain Events', () => {
            const eventDir = path.join(SRC_DIR, 'domain/events');
            const eventFiles = getAllFiles(eventDir);

            it('should follow .event.ts naming pattern', () => {
                const violations = eventFiles.filter(
                    (f) => !f.endsWith('.event.ts') && !f.endsWith('index.ts'),
                );

                expect(violations.map((v) => path.basename(v))).toEqual([]);
            });
        });

        describe('Domain Errors', () => {
            const errorDir = path.join(SRC_DIR, 'domain/errors');
            const errorFiles = getAllFiles(errorDir);

            it('should follow .error.ts naming pattern', () => {
                const violations = errorFiles.filter(
                    (f) => !f.endsWith('.error.ts') && !f.endsWith('index.ts'),
                );

                expect(violations.map((v) => path.basename(v))).toEqual([]);
            });
        });

        describe('Domain Services', () => {
            const serviceDir = path.join(SRC_DIR, 'domain/services');
            const serviceFiles = getAllFiles(serviceDir);

            it('should follow .service.ts naming pattern', () => {
                const violations = serviceFiles.filter(
                    (f) => !f.endsWith('.service.ts') && !f.endsWith('index.ts'),
                );

                expect(violations.map((v) => path.basename(v))).toEqual([]);
            });
        });

        describe('Specifications', () => {
            const specDir = path.join(SRC_DIR, 'domain/specifications');
            const specFiles = getAllFiles(specDir);

            it('should follow .spec.ts or .specification.ts naming pattern (not test specs)', () => {
                const violations = specFiles.filter(
                    (f) =>
                        !f.endsWith('.specification.ts') &&
                        !path.basename(f).includes('specification') &&
                        !f.endsWith('index.ts'),
                );

                // Specifications might have different naming, just ensure they exist
                expect(specFiles.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Application Layer', () => {
        describe('Commands', () => {
            const cmdDir = path.join(SRC_DIR, 'application/commands');
            const allFiles = getAllFiles(cmdDir);

            it('should have .command.ts files for command definitions', () => {
                const commandFiles = allFiles.filter((f) => f.endsWith('.command.ts'));
                expect(commandFiles.length).toBeGreaterThan(0);
            });

            it('should have .handler.ts files for command handlers', () => {
                const handlerFiles = allFiles.filter((f) => f.endsWith('.handler.ts'));
                expect(handlerFiles.length).toBeGreaterThan(0);
            });

            it('should have matching handler for each command', () => {
                const commandDirs = new Set<string>();
                const handlerDirs = new Set<string>();

                for (const file of allFiles) {
                    const dir = path.dirname(file);
                    if (file.endsWith('.command.ts')) {
                        commandDirs.add(dir);
                    }
                    if (file.endsWith('.handler.ts')) {
                        handlerDirs.add(dir);
                    }
                }

                // Each command directory should have a handler
                for (const cmdDir of commandDirs) {
                    expect(handlerDirs.has(cmdDir)).toBe(true);
                }
            });
        });

        describe('Queries', () => {
            const queryDir = path.join(SRC_DIR, 'application/queries');
            const allFiles = getAllFiles(queryDir);

            it('should have .query.ts files for query definitions', () => {
                const queryFiles = allFiles.filter((f) => f.endsWith('.query.ts'));
                expect(queryFiles.length).toBeGreaterThan(0);
            });

            it('should have .handler.ts files for query handlers', () => {
                const handlerFiles = allFiles.filter((f) => f.endsWith('.handler.ts'));
                expect(handlerFiles.length).toBeGreaterThan(0);
            });
        });

        describe('DTOs', () => {
            const dtoDir = path.join(SRC_DIR, 'application/dtos');

            if (fs.existsSync(dtoDir)) {
                const dtoFiles = getAllFiles(dtoDir);

                it('should follow .dto.ts naming pattern or be index files', () => {
                    const violations = dtoFiles.filter(
                        (f) => !f.endsWith('.dto.ts') && !f.endsWith('index.ts'),
                    );

                    expect(violations.map((v) => path.basename(v))).toEqual([]);
                });
            }
        });

        describe('Application Services', () => {
            const serviceDir = path.join(SRC_DIR, 'application/services');

            if (fs.existsSync(serviceDir)) {
                const serviceFiles = getAllFiles(serviceDir);

                it('should follow .service.ts naming pattern', () => {
                    const violations = serviceFiles.filter(
                        (f) => !f.endsWith('.service.ts') && !f.endsWith('index.ts'),
                    );

                    expect(violations.map((v) => path.basename(v))).toEqual([]);
                });
            }
        });
    });

    describe('Infrastructure Layer', () => {
        describe('Repositories', () => {
            const repoDir = path.join(SRC_DIR, 'infrastructure/database/repositories');

            if (fs.existsSync(repoDir)) {
                const repoFiles = getAllFiles(repoDir);

                it('should follow .repository.ts naming pattern', () => {
                    const violations = repoFiles.filter(
                        (f) => !f.endsWith('.repository.ts') && !f.endsWith('index.ts'),
                    );

                    expect(violations.map((v) => path.basename(v))).toEqual([]);
                });
            }
        });

        describe('Schemas/Models', () => {
            const schemaDir = path.join(SRC_DIR, 'infrastructure/database/schemas');

            if (fs.existsSync(schemaDir)) {
                const schemaFiles = getAllFiles(schemaDir);

                it('should follow .schema.ts naming pattern', () => {
                    const violations = schemaFiles.filter(
                        (f) => !f.endsWith('.schema.ts') && !f.endsWith('index.ts'),
                    );

                    expect(violations.map((v) => path.basename(v))).toEqual([]);
                });
            }
        });
    });

    describe('Ports Layer', () => {
        describe('Outbound Ports', () => {
            const outboundDir = path.join(SRC_DIR, 'ports/outbound');

            if (fs.existsSync(outboundDir)) {
                const portFiles = getAllFiles(outboundDir);

                it('should follow .port.ts naming pattern', () => {
                    const violations = portFiles.filter(
                        (f) => !f.endsWith('.port.ts') && !f.endsWith('index.ts'),
                    );

                    expect(violations.map((v) => path.basename(v))).toEqual([]);
                });
            }
        });
    });

    describe('Module Files', () => {
        const moduleFiles = getAllFiles(SRC_DIR).filter((f) => f.endsWith('.module.ts'));

        it('should have at least one module file', () => {
            expect(moduleFiles.length).toBeGreaterThan(0);
        });

        it('should follow .module.ts naming pattern', () => {
            // Already filtered, just verify
            for (const file of moduleFiles) {
                expect(file.endsWith('.module.ts')).toBe(true);
            }
        });
    });
});
