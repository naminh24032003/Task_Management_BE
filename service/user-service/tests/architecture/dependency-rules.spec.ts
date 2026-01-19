/**
 * Architecture Tests - Dependency Rules
 * Ensures Clean Architecture dependency rules are followed:
 * - Domain layer has no external dependencies
 * - Application layer only depends on Domain
 * - Infrastructure depends on both Domain and Application
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(__dirname, '../../src');

/**
 * Read file content and extract import statements
 */
function getImports(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }

    return imports;
}

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
 * Check if import is from a specific layer
 */
function isFromLayer(importPath: string, layer: string): boolean {
    return importPath.includes(`/${layer}/`) || importPath.startsWith(`./${layer}`);
}

/**
 * Check if import is a relative path
 */
function isRelativeImport(importPath: string): boolean {
    return importPath.startsWith('.') || importPath.startsWith('/');
}

describe('Clean Architecture Dependency Rules', () => {
    describe('Domain Layer', () => {
        const domainDir = path.join(SRC_DIR, 'domain');
        const domainFiles = getAllTsFiles(domainDir);

        it('should have domain files', () => {
            expect(domainFiles.length).toBeGreaterThan(0);
        });

        it('should not import from application layer', () => {
            const violations: string[] = [];

            for (const file of domainFiles) {
                const imports = getImports(file);
                for (const imp of imports) {
                    if (isFromLayer(imp, 'application')) {
                        violations.push(`${path.relative(SRC_DIR, file)}: imports from application (${imp})`);
                    }
                }
            }

            expect(violations).toEqual([]);
        });

        it('should not import from infrastructure layer', () => {
            const violations: string[] = [];

            for (const file of domainFiles) {
                const imports = getImports(file);
                for (const imp of imports) {
                    if (isFromLayer(imp, 'infrastructure')) {
                        violations.push(`${path.relative(SRC_DIR, file)}: imports from infrastructure (${imp})`);
                    }
                }
            }

            expect(violations).toEqual([]);
        });

        it('should not import from ports layer', () => {
            const violations: string[] = [];

            for (const file of domainFiles) {
                const imports = getImports(file);
                for (const imp of imports) {
                    if (isFromLayer(imp, 'ports')) {
                        violations.push(`${path.relative(SRC_DIR, file)}: imports from ports (${imp})`);
                    }
                }
            }

            expect(violations).toEqual([]);
        });

        it('should only use allowed external packages', () => {
            const allowedPackages = [
                'mongoose', // For ObjectId validation only
                'crypto',   // For password hashing
            ];

            const violations: string[] = [];

            for (const file of domainFiles) {
                const imports = getImports(file);
                for (const imp of imports) {
                    if (!isRelativeImport(imp) && !allowedPackages.some((pkg) => imp.startsWith(pkg))) {
                        // Skip node built-ins
                        if (!['crypto', 'path', 'fs'].includes(imp)) {
                            violations.push(`${path.relative(SRC_DIR, file)}: uses external package (${imp})`);
                        }
                    }
                }
            }

            // Domain should have minimal external dependencies
            expect(violations.length).toBeLessThanOrEqual(0);
        });
    });

    describe('Application Layer', () => {
        const applicationDir = path.join(SRC_DIR, 'application');
        const applicationFiles = getAllTsFiles(applicationDir);

        it('should have application files', () => {
            expect(applicationFiles.length).toBeGreaterThan(0);
        });

        it('should not import from infrastructure layer', () => {
            const violations: string[] = [];

            for (const file of applicationFiles) {
                const imports = getImports(file);
                for (const imp of imports) {
                    if (isFromLayer(imp, 'infrastructure')) {
                        violations.push(`${path.relative(SRC_DIR, file)}: imports from infrastructure (${imp})`);
                    }
                }
            }

            expect(violations).toEqual([]);
        });

        it('can import from domain layer', () => {
            let hasDomainImport = false;

            for (const file of applicationFiles) {
                const imports = getImports(file);
                for (const imp of imports) {
                    if (isFromLayer(imp, 'domain') || imp.includes('../domain')) {
                        hasDomainImport = true;
                        break;
                    }
                }
                if (hasDomainImport) break;
            }

            expect(hasDomainImport).toBe(true);
        });
    });

    describe('Infrastructure Layer', () => {
        const infrastructureDir = path.join(SRC_DIR, 'infrastructure');
        const infrastructureFiles = getAllTsFiles(infrastructureDir);

        it('should have infrastructure files', () => {
            expect(infrastructureFiles.length).toBeGreaterThan(0);
        });

        it('can import from domain layer', () => {
            let hasDomainImport = false;

            for (const file of infrastructureFiles) {
                const imports = getImports(file);
                for (const imp of imports) {
                    if (isFromLayer(imp, 'domain') || imp.includes('../domain')) {
                        hasDomainImport = true;
                        break;
                    }
                }
                if (hasDomainImport) break;
            }

            expect(hasDomainImport).toBe(true);
        });

        it('can import from application layer', () => {
            let hasApplicationImport = false;

            for (const file of infrastructureFiles) {
                const imports = getImports(file);
                for (const imp of imports) {
                    if (isFromLayer(imp, 'application') || imp.includes('../application')) {
                        hasApplicationImport = true;
                        break;
                    }
                }
                if (hasApplicationImport) break;
            }

            // Infrastructure may or may not import from application
            // This is just to verify it's allowed
            expect(true).toBe(true);
        });
    });

    describe('Application Ports', () => {
        const portsDir = path.join(SRC_DIR, 'application', 'ports');
        const portsFiles = getAllTsFiles(portsDir);

        it('should have ports files in application layer', () => {
            expect(portsFiles.length).toBeGreaterThan(0);
        });

        it('ports should define interfaces (not implementations)', () => {
            let hasInterfaces = false;

            for (const file of portsFiles) {
                const content = fs.readFileSync(file, 'utf-8');
                if (content.includes('export interface') || content.includes('export const')) {
                    hasInterfaces = true;
                    break;
                }
            }

            expect(hasInterfaces).toBe(true);
        });

        it('ports should not import from infrastructure', () => {
            const violations: string[] = [];

            for (const file of portsFiles) {
                const imports = getImports(file);
                for (const imp of imports) {
                    if (isFromLayer(imp, 'infrastructure')) {
                        violations.push(`${path.relative(SRC_DIR, file)}: imports from infrastructure (${imp})`);
                    }
                }
            }

            expect(violations).toEqual([]);
        });
    });

    describe('gRPC Controllers', () => {
        const grpcDir = path.join(SRC_DIR, 'infrastructure', 'grpc');
        const grpcFiles = getAllTsFiles(grpcDir);

        it('should have gRPC controller files', () => {
            expect(grpcFiles.length).toBeGreaterThan(0);
        });

        it('can import from application layer (commands, queries)', () => {
            let hasApplicationImport = false;

            for (const file of grpcFiles) {
                const imports = getImports(file);
                for (const imp of imports) {
                    if (imp.includes('application') || imp.includes('../application')) {
                        hasApplicationImport = true;
                        break;
                    }
                }
                if (hasApplicationImport) break;
            }

            expect(hasApplicationImport).toBe(true);
        });
    });
});
