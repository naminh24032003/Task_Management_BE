/**
 * Architecture Tests - Layer Isolation
 * Ensures proper layer separation and interface-based communication
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(__dirname, '../../src');

/**
 * Get all TypeScript files in a directory recursively
 */
function getAllTsFiles(dir: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
        return files;
    }

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            files.push(...getAllTsFiles(fullPath));
        } else if (item.name.endsWith('.ts') && !item.name.endsWith('.spec.ts')) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Check if file contains interface definitions
 */
function hasInterfaceDefinition(filePath: string): boolean {
    const content = fs.readFileSync(filePath, 'utf-8');
    return /export\s+interface\s+/.test(content);
}

/**
 * Check if file exports a Symbol token
 */
function hasSymbolToken(filePath: string): boolean {
    const content = fs.readFileSync(filePath, 'utf-8');
    return /export\s+const\s+\w+\s*=\s*Symbol\(/.test(content);
}

/**
 * Get class names from file
 */
function getClassNames(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const classRegex = /export\s+class\s+(\w+)/g;
    const classes: string[] = [];
    let match;

    while ((match = classRegex.exec(content)) !== null) {
        classes.push(match[1]);
    }

    return classes;
}

/**
 * Check if file uses dependency injection decorators
 */
function usesDependencyInjection(filePath: string): boolean {
    const content = fs.readFileSync(filePath, 'utf-8');
    return /@Inject\(/.test(content) || /@Injectable\(/.test(content);
}

describe('Layer Isolation', () => {
    describe('Domain Layer Isolation', () => {
        const domainDir = path.join(SRC_DIR, 'domain');
        const domainFiles = getAllTsFiles(domainDir);

        it('should not use NestJS dependency injection in domain', () => {
            const violations: string[] = [];

            for (const file of domainFiles) {
                const content = fs.readFileSync(file, 'utf-8');

                if (/@Injectable\(/.test(content)) {
                    violations.push(`${path.relative(SRC_DIR, file)}: uses @Injectable`);
                }
                if (/@Inject\(/.test(content)) {
                    violations.push(`${path.relative(SRC_DIR, file)}: uses @Inject`);
                }
            }

            expect(violations).toEqual([]);
        });

        it('should not use NestJS modules in domain', () => {
            const violations: string[] = [];

            for (const file of domainFiles) {
                const content = fs.readFileSync(file, 'utf-8');

                if (/@Module\(/.test(content)) {
                    violations.push(`${path.relative(SRC_DIR, file)}: uses @Module`);
                }
            }

            expect(violations).toEqual([]);
        });

        it('domain aggregates should be pure classes', () => {
            const aggregateDir = path.join(domainDir, 'aggregates');
            const aggregateFiles = getAllTsFiles(aggregateDir);

            for (const file of aggregateFiles) {
                const classes = getClassNames(file);
                expect(classes.length).toBeGreaterThan(0);

                // Verify no framework decorators
                const content = fs.readFileSync(file, 'utf-8');
                expect(/@Injectable/.test(content)).toBe(false);
            }
        });

        it('domain value objects should be immutable', () => {
            const voDir = path.join(domainDir, 'value-objects');
            const voFiles = getAllTsFiles(voDir);

            for (const file of voFiles) {
                const content = fs.readFileSync(file, 'utf-8');

                // Check for Object.freeze usage or readonly properties
                const hasImmutability =
                    content.includes('Object.freeze') ||
                    content.includes('readonly') ||
                    content.includes('private readonly');

                expect(hasImmutability).toBe(true);
            }
        });
    });

    describe('Application Layer Ports', () => {
        const portsDir = path.join(SRC_DIR, 'application/ports');

        if (fs.existsSync(portsDir)) {
            const portFiles = getAllTsFiles(portsDir);

            it('should define interfaces in port files', () => {
                let hasInterface = false;

                for (const file of portFiles) {
                    if (hasInterfaceDefinition(file)) {
                        hasInterface = true;
                        break;
                    }
                }

                expect(hasInterface).toBe(true);
            });

            it('should export Symbol tokens for dependency injection', () => {
                let hasToken = false;

                for (const file of portFiles) {
                    if (hasSymbolToken(file)) {
                        hasToken = true;
                        break;
                    }
                }

                expect(hasToken).toBe(true);
            });
        }
    });

    describe('Infrastructure implements interfaces', () => {
        const infraDir = path.join(SRC_DIR, 'infrastructure');
        const infraFiles = getAllTsFiles(infraDir);

        it('should use @Injectable decorator', () => {
            let hasInjectable = false;

            for (const file of infraFiles) {
                const content = fs.readFileSync(file, 'utf-8');
                if (/@Injectable\(/.test(content)) {
                    hasInjectable = true;
                    break;
                }
            }

            expect(hasInjectable).toBe(true);
        });

        it('domain repositories should implement port interfaces', () => {
            // Only domain repositories (implementing Clean Architecture ports) should implement interfaces
            // Legacy TypeORM/MongoDB repositories that extend Repository<Entity> don't need custom interfaces
            const domainRepoFiles = infraFiles.filter((f) =>
                f.includes('-domain.repository')
            );

            for (const file of domainRepoFiles) {
                const content = fs.readFileSync(file, 'utf-8');
                // Should implement an interface
                const hasImplements = /class\s+\w+\s+implements\s+/.test(content);

                if (getClassNames(file).length > 0) {
                    expect(hasImplements).toBe(true);
                }
            }
        });
    });

    describe('CQRS Pattern', () => {
        describe('Commands', () => {
            const commandDir = path.join(SRC_DIR, 'application/commands');
            const commandFiles = getAllTsFiles(commandDir);

            it('should have command classes', () => {
                const commands = commandFiles.filter((f) => f.endsWith('.command.ts'));
                expect(commands.length).toBeGreaterThan(0);
            });

            it('command handlers should use @CommandHandler decorator', () => {
                const handlers = commandFiles.filter((f) => f.endsWith('.handler.ts'));

                for (const file of handlers) {
                    const content = fs.readFileSync(file, 'utf-8');
                    expect(/@CommandHandler\(/.test(content)).toBe(true);
                }
            });

            it('command handlers should implement ICommandHandler', () => {
                const handlers = commandFiles.filter((f) => f.endsWith('.handler.ts'));

                for (const file of handlers) {
                    const content = fs.readFileSync(file, 'utf-8');
                    expect(/implements\s+ICommandHandler/.test(content)).toBe(true);
                }
            });
        });

        describe('Queries', () => {
            const queryDir = path.join(SRC_DIR, 'application/queries');
            const queryFiles = getAllTsFiles(queryDir);

            it('should have query classes', () => {
                const queries = queryFiles.filter((f) => f.endsWith('.query.ts'));
                expect(queries.length).toBeGreaterThan(0);
            });

            it('query handlers should use @QueryHandler decorator', () => {
                const handlers = queryFiles.filter((f) => f.endsWith('.handler.ts'));

                for (const file of handlers) {
                    const content = fs.readFileSync(file, 'utf-8');
                    expect(/@QueryHandler\(/.test(content)).toBe(true);
                }
            });

            it('query handlers should implement IQueryHandler', () => {
                const handlers = queryFiles.filter((f) => f.endsWith('.handler.ts'));

                for (const file of handlers) {
                    const content = fs.readFileSync(file, 'utf-8');
                    expect(/implements\s+IQueryHandler/.test(content)).toBe(true);
                }
            });
        });
    });

    describe('Module Organization', () => {
        it('each layer should have its own module file', () => {
            const layers = ['application', 'infrastructure'];
            const missingModules: string[] = [];

            for (const layer of layers) {
                const moduleFile = path.join(SRC_DIR, layer, `${layer}.module.ts`);
                if (!fs.existsSync(moduleFile)) {
                    missingModules.push(`${layer}/${layer}.module.ts`);
                }
            }

            expect(missingModules).toEqual([]);
        });

        it('app.module.ts should exist at root', () => {
            const appModule = path.join(SRC_DIR, 'app.module.ts');
            expect(fs.existsSync(appModule)).toBe(true);
        });
    });

    describe('Clean Architecture Adapters', () => {
        it('should have gRPC controllers in infrastructure layer', () => {
            const grpcDir = path.join(SRC_DIR, 'infrastructure/grpc');
            expect(fs.existsSync(grpcDir)).toBe(true);

            if (fs.existsSync(grpcDir)) {
                const grpcFiles = getAllTsFiles(grpcDir);
                const controllers = grpcFiles.filter((f) => f.includes('.controller.ts'));
                expect(controllers.length).toBeGreaterThan(0);
            }
        });

        it('gRPC controllers should use @Controller decorator', () => {
            const grpcDir = path.join(SRC_DIR, 'infrastructure/grpc');

            if (fs.existsSync(grpcDir)) {
                const grpcFiles = getAllTsFiles(grpcDir);
                const controllers = grpcFiles.filter((f) => f.includes('.controller.ts'));

                for (const file of controllers) {
                    const content = fs.readFileSync(file, 'utf-8');
                    expect(/@Controller\(/.test(content)).toBe(true);
                }
            }
        });
    });
});
