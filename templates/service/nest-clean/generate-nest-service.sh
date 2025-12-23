#!/bin/bash

# =============================================================================
# NestJS Clean Architecture Service Generator
# Based on user-service architecture (Clean Architecture + DDD + Hexagonal)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Show usage
usage() {
    echo "Usage: $0 <service-name> [options]"
    echo ""
    echo "Options:"
    echo "  -d, --directory    Target directory (default: ./service)"
    echo "  -p, --port         gRPC port (default: 50051)"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 order-service"
    echo "  $0 payment-service -d ./services -p 50052"
    exit 1
}

# Default values
SERVICE_NAME=""
TARGET_DIR="./service"
GRPC_PORT="50051"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--directory)
            TARGET_DIR="$2"
            shift 2
            ;;
        -p|--port)
            GRPC_PORT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [[ -z "$SERVICE_NAME" ]]; then
                SERVICE_NAME="$1"
            fi
            shift
            ;;
    esac
done

# Validate service name
if [[ -z "$SERVICE_NAME" ]]; then
    print_error "Service name is required!"
    usage
fi

# Convert service name for use in code
SERVICE_SHORT=$(echo "$SERVICE_NAME" | sed 's/-service$//')
SERVICE_PASCAL=$(echo "$SERVICE_SHORT" | sed -r 's/(^|-)(\w)/\U\2/g')
SERVICE_LOWER=$(echo "$SERVICE_SHORT" | tr '[:upper:]' '[:lower:]')
SERVICE_KEBAB=$(echo "$SERVICE_SHORT" | tr '[:upper:]' '[:lower:]' | tr '_' '-')

SERVICE_PATH="$TARGET_DIR/$SERVICE_NAME"

print_info "Creating NestJS Clean Architecture service: $SERVICE_NAME"
print_info "Target directory: $SERVICE_PATH"

# Check if directory exists
if [[ -d "$SERVICE_PATH" ]]; then
    print_error "Directory $SERVICE_PATH already exists!"
    exit 1
fi

# Create directory structure
print_info "Creating directory structure..."

mkdir -p "$SERVICE_PATH"/src/{application,domain,ports,shared}

# Application layer
mkdir -p "$SERVICE_PATH"/src/application/{commands,dtos,errors,integration-events,queries,services}
mkdir -p "$SERVICE_PATH"/src/application/commands/{create-${SERVICE_KEBAB},update-${SERVICE_KEBAB},delete-${SERVICE_KEBAB}}
mkdir -p "$SERVICE_PATH"/src/application/queries/{get-${SERVICE_KEBAB}-by-id,list-${SERVICE_KEBAB}s}

# Domain layer
mkdir -p "$SERVICE_PATH"/src/domain/{aggregates,entities,errors,events,services,specifications,value-objects}

# Ports layer (Hexagonal)
mkdir -p "$SERVICE_PATH"/src/ports/{inbound,outbound}
mkdir -p "$SERVICE_PATH"/src/ports/inbound/{commands,queries}
mkdir -p "$SERVICE_PATH"/src/ports/outbound/repositories

# Shared layer
mkdir -p "$SERVICE_PATH"/src/shared/{application,domain,errors}

# Tests
mkdir -p "$SERVICE_PATH"/tests/{architecture,integration,unit}
mkdir -p "$SERVICE_PATH"/tests/integration/{commands,queries}
mkdir -p "$SERVICE_PATH"/tests/unit/{application,domain}

print_success "Directory structure created!"

# =============================================================================
# Create package.json
# =============================================================================
print_info "Creating package.json..."
cat > "$SERVICE_PATH/package.json" << EOF
{
  "name": "$SERVICE_NAME",
  "version": "0.0.1",
  "description": "$SERVICE_PASCAL service with Clean Architecture",
  "author": "",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,tests}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./tests/jest-e2e.json",
    "test:arch": "jest --config ./tests/architecture/jest.config.js"
  },
  "dependencies": {
    "@grpc/grpc-js": "^1.9.14",
    "@grpc/proto-loader": "^0.7.10",
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/microservices": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "@types/jest": "^29.5.2",
    "@types/node": "^20.3.1",
    "@types/uuid": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.42.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-prettier": "^5.0.0",
    "jest": "^29.5.0",
    "prettier": "^3.0.0",
    "source-map-support": "^0.5.21",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.3",
    "ts-node": "^10.9.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.3"
  }
}
EOF

# =============================================================================
# Create tsconfig.json
# =============================================================================
print_info "Creating tsconfig.json..."
cat > "$SERVICE_PATH/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"],
      "@ports/*": ["src/ports/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
EOF

# =============================================================================
# Create nest-cli.json
# =============================================================================
print_info "Creating nest-cli.json..."
cat > "$SERVICE_PATH/nest-cli.json" << 'EOF'
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": ["**/*.proto"]
  }
}
EOF

# =============================================================================
# Create jest.config.js
# =============================================================================
print_info "Creating jest.config.js..."
cat > "$SERVICE_PATH/jest.config.js" << 'EOF'
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/tests/'],
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@ports/(.*)$': '<rootDir>/src/ports/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },
};
EOF

# =============================================================================
# Create .eslintrc.js
# =============================================================================
print_info "Creating .eslintrc.js..."
cat > "$SERVICE_PATH/.eslintrc.js" << 'EOF'
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
EOF

# =============================================================================
# Create .prettierrc
# =============================================================================
print_info "Creating .prettierrc..."
cat > "$SERVICE_PATH/.prettierrc" << 'EOF'
{
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100
}
EOF

# =============================================================================
# Create main.ts
# =============================================================================
print_info "Creating src/main.ts..."
cat > "$SERVICE_PATH/src/main.ts" << EOF
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: '${SERVICE_LOWER}',
      protoPath: join(__dirname, '${SERVICE_LOWER}.proto'),
      url: 'localhost:${GRPC_PORT}',
    },
  });

  app.enableShutdownHooks();
  await app.listen();
  console.log('${SERVICE_PASCAL} Service is listening on localhost:${GRPC_PORT}');
}

bootstrap();
EOF

# =============================================================================
# Create app.module.ts
# =============================================================================
print_info "Creating src/app.module.ts..."
cat > "$SERVICE_PATH/src/app.module.ts" << EOF
import { Module } from '@nestjs/common';
import { ${SERVICE_PASCAL}Controller } from './ports/inbound/${SERVICE_LOWER}.controller';

@Module({
  imports: [],
  controllers: [${SERVICE_PASCAL}Controller],
  providers: [],
})
export class AppModule {}
EOF

# =============================================================================
# Create proto file
# =============================================================================
print_info "Creating src/${SERVICE_LOWER}.proto..."
cat > "$SERVICE_PATH/src/${SERVICE_LOWER}.proto" << EOF
syntax = "proto3";

package ${SERVICE_LOWER};

service ${SERVICE_PASCAL}Service {
  rpc Create${SERVICE_PASCAL}(Create${SERVICE_PASCAL}Request) returns (Create${SERVICE_PASCAL}Response);
  rpc Get${SERVICE_PASCAL}(Get${SERVICE_PASCAL}Request) returns (Get${SERVICE_PASCAL}Response);
  rpc List${SERVICE_PASCAL}s(List${SERVICE_PASCAL}sRequest) returns (List${SERVICE_PASCAL}sResponse);
  rpc Update${SERVICE_PASCAL}(Update${SERVICE_PASCAL}Request) returns (Update${SERVICE_PASCAL}Response);
  rpc Delete${SERVICE_PASCAL}(Delete${SERVICE_PASCAL}Request) returns (Delete${SERVICE_PASCAL}Response);
}

message Create${SERVICE_PASCAL}Request {
  string name = 1;
}

message Create${SERVICE_PASCAL}Response {
  string id = 1;
  string name = 2;
  string created_at = 3;
}

message Get${SERVICE_PASCAL}Request {
  string id = 1;
}

message Get${SERVICE_PASCAL}Response {
  string id = 1;
  string name = 2;
  string created_at = 3;
  string updated_at = 4;
}

message List${SERVICE_PASCAL}sRequest {
  int32 page = 1;
  int32 page_size = 2;
}

message List${SERVICE_PASCAL}sResponse {
  repeated Get${SERVICE_PASCAL}Response items = 1;
  int32 total = 2;
}

message Update${SERVICE_PASCAL}Request {
  string id = 1;
  string name = 2;
}

message Update${SERVICE_PASCAL}Response {
  string id = 1;
  string name = 2;
  string updated_at = 3;
}

message Delete${SERVICE_PASCAL}Request {
  string id = 1;
}

message Delete${SERVICE_PASCAL}Response {
  bool success = 1;
}
EOF

# =============================================================================
# Create Domain Layer
# =============================================================================
print_info "Creating domain layer..."

# Aggregate Root
cat > "$SERVICE_PATH/src/domain/aggregates/${SERVICE_LOWER}.aggregate.ts" << EOF
import { AggregateRoot } from '@shared/domain/aggregate-root';
import { ${SERVICE_PASCAL}Id } from '../value-objects/${SERVICE_LOWER}-id.vo';
import { ${SERVICE_PASCAL}CreatedEvent } from '../events/${SERVICE_LOWER}-created.event';

export interface ${SERVICE_PASCAL}Props {
  id: ${SERVICE_PASCAL}Id;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ${SERVICE_PASCAL} extends AggregateRoot<${SERVICE_PASCAL}Props> {
  private constructor(props: ${SERVICE_PASCAL}Props) {
    super(props);
  }

  public static create(id: ${SERVICE_PASCAL}Id, name: string): ${SERVICE_PASCAL} {
    const now = new Date();
    const ${SERVICE_LOWER} = new ${SERVICE_PASCAL}({
      id,
      name,
      createdAt: now,
      updatedAt: now,
    });

    ${SERVICE_LOWER}.addDomainEvent(new ${SERVICE_PASCAL}CreatedEvent(id.value, name, now));

    return ${SERVICE_LOWER};
  }

  public get id(): ${SERVICE_PASCAL}Id {
    return this.props.id;
  }

  public get name(): string {
    return this.props.name;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public updateName(name: string): void {
    this.props.name = name;
    this.props.updatedAt = new Date();
  }
}
EOF

# Value Object - ID
cat > "$SERVICE_PATH/src/domain/value-objects/${SERVICE_LOWER}-id.vo.ts" << EOF
import { ValueObject } from '@shared/domain/value-object';

interface ${SERVICE_PASCAL}IdProps {
  value: string;
}

export class ${SERVICE_PASCAL}Id extends ValueObject<${SERVICE_PASCAL}IdProps> {
  private constructor(props: ${SERVICE_PASCAL}IdProps) {
    super(props);
  }

  public static create(id: string): ${SERVICE_PASCAL}Id {
    if (!id || id.trim().length === 0) {
      throw new Error('${SERVICE_PASCAL} ID cannot be empty');
    }
    return new ${SERVICE_PASCAL}Id({ value: id });
  }

  public get value(): string {
    return this.props.value;
  }

  protected validate(): void {
    if (!this.props.value) {
      throw new Error('${SERVICE_PASCAL} ID is required');
    }
  }
}
EOF

# Domain Event
cat > "$SERVICE_PATH/src/domain/events/${SERVICE_LOWER}-created.event.ts" << EOF
import { DomainEvent } from '@shared/domain/domain-event';

export class ${SERVICE_PASCAL}CreatedEvent extends DomainEvent {
  constructor(
    public readonly ${SERVICE_LOWER}Id: string,
    public readonly name: string,
    public readonly occurredAt: Date,
  ) {
    super();
  }

  eventName(): string {
    return '${SERVICE_LOWER}.created';
  }
}
EOF

# Domain Error
cat > "$SERVICE_PATH/src/domain/errors/${SERVICE_LOWER}-domain.error.ts" << EOF
import { BaseError } from '@shared/errors/base.error';

export class ${SERVICE_PASCAL}DomainError extends BaseError {
  constructor(message: string) {
    super(message, '${SERVICE_PASCAL.toUpperCase()}_DOMAIN_ERROR');
  }
}
EOF

cat > "$SERVICE_PATH/src/domain/errors/${SERVICE_LOWER}-not-found.error.ts" << EOF
import { BaseError } from '@shared/errors/base.error';

export class ${SERVICE_PASCAL}NotFoundError extends BaseError {
  constructor(id: string) {
    super(\`${SERVICE_PASCAL} with id \${id} not found\`, '${SERVICE_PASCAL.toUpperCase()}_NOT_FOUND');
  }
}
EOF

# Domain Service
cat > "$SERVICE_PATH/src/domain/services/${SERVICE_LOWER}-validation.service.ts" << EOF
export class ${SERVICE_PASCAL}ValidationService {
  validateName(name: string): boolean {
    return name && name.trim().length >= 3 && name.trim().length <= 100;
  }
}
EOF

# =============================================================================
# Create Shared Layer
# =============================================================================
print_info "Creating shared layer..."

# Aggregate Root Base
cat > "$SERVICE_PATH/src/shared/domain/aggregate-root.ts" << 'EOF'
import { DomainEvent } from './domain-event';

export abstract class AggregateRoot<T> {
  protected props: T;
  private _domainEvents: DomainEvent[] = [];

  protected constructor(props: T) {
    this.props = props;
  }

  get domainEvents(): DomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }
}
EOF

# Value Object Base
cat > "$SERVICE_PATH/src/shared/domain/value-object.ts" << 'EOF'
export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
    this.validate();
  }

  protected abstract validate(): void;

  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
EOF

# Domain Event Base
cat > "$SERVICE_PATH/src/shared/domain/domain-event.ts" << 'EOF'
export abstract class DomainEvent {
  public readonly occurredOn: Date;

  protected constructor() {
    this.occurredOn = new Date();
  }

  abstract eventName(): string;
}
EOF

# Entity Base
cat > "$SERVICE_PATH/src/shared/domain/entity.ts" << 'EOF'
export abstract class Entity<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = props;
  }

  public equals(entity?: Entity<T>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }
    return this === entity;
  }
}
EOF

# Base Error
cat > "$SERVICE_PATH/src/shared/errors/base.error.ts" << 'EOF'
export abstract class BaseError extends Error {
  public readonly code: string;

  protected constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
EOF

# Application Error
cat > "$SERVICE_PATH/src/shared/errors/application.error.ts" << 'EOF'
import { BaseError } from './base.error';

export class ApplicationError extends BaseError {
  constructor(message: string, code: string = 'APPLICATION_ERROR') {
    super(message, code);
  }
}
EOF

# Result type
cat > "$SERVICE_PATH/src/shared/result.ts" << 'EOF'
export class Result<T> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  public readonly error?: string;
  private readonly _value?: T;

  private constructor(isSuccess: boolean, error?: string, value?: T) {
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this.error = error;
    this._value = value;
  }

  public getValue(): T {
    if (!this.isSuccess) {
      throw new Error('Cannot get value of a failed result');
    }
    return this._value as T;
  }

  public static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }

  public static fail<U>(error: string): Result<U> {
    return new Result<U>(false, error);
  }
}
EOF

# Either type
cat > "$SERVICE_PATH/src/shared/either.ts" << 'EOF'
export type Either<L, R> = Left<L, R> | Right<L, R>;

export class Left<L, R> {
  readonly value: L;

  constructor(value: L) {
    this.value = value;
  }

  isLeft(): this is Left<L, R> {
    return true;
  }

  isRight(): this is Right<L, R> {
    return false;
  }
}

export class Right<L, R> {
  readonly value: R;

  constructor(value: R) {
    this.value = value;
  }

  isLeft(): this is Left<L, R> {
    return false;
  }

  isRight(): this is Right<L, R> {
    return true;
  }
}

export const left = <L, R>(l: L): Either<L, R> => new Left(l);
export const right = <L, R>(r: R): Either<L, R> => new Right(r);
EOF

# Command base
cat > "$SERVICE_PATH/src/shared/application/command.ts" << 'EOF'
export abstract class Command {}
EOF

# Command Handler base
cat > "$SERVICE_PATH/src/shared/application/command-handler.ts" << 'EOF'
import { Command } from './command';

export interface CommandHandler<T extends Command, R> {
  execute(command: T): Promise<R>;
}
EOF

# Query base
cat > "$SERVICE_PATH/src/shared/application/query.ts" << 'EOF'
export abstract class Query {}
EOF

# Query Handler base
cat > "$SERVICE_PATH/src/shared/application/query-handler.ts" << 'EOF'
import { Query } from './query';

export interface QueryHandler<T extends Query, R> {
  execute(query: T): Promise<R>;
}
EOF

# =============================================================================
# Create Application Layer
# =============================================================================
print_info "Creating application layer..."

# DTOs
cat > "$SERVICE_PATH/src/application/dtos/${SERVICE_LOWER}.dto.ts" << EOF
export interface ${SERVICE_PASCAL}Dto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
EOF

cat > "$SERVICE_PATH/src/application/dtos/create-${SERVICE_LOWER}.dto.ts" << EOF
export interface Create${SERVICE_PASCAL}Dto {
  name: string;
}
EOF

cat > "$SERVICE_PATH/src/application/dtos/update-${SERVICE_LOWER}.dto.ts" << EOF
export interface Update${SERVICE_PASCAL}Dto {
  id: string;
  name: string;
}
EOF

# Application Errors
cat > "$SERVICE_PATH/src/application/errors/application.error.ts" << EOF
import { ApplicationError } from '@shared/errors/application.error';

export class ${SERVICE_PASCAL}ApplicationError extends ApplicationError {
  constructor(message: string) {
    super(message, '${SERVICE_PASCAL.toUpperCase()}_APPLICATION_ERROR');
  }
}
EOF

cat > "$SERVICE_PATH/src/application/errors/${SERVICE_LOWER}-not-found.error.ts" << EOF
import { ApplicationError } from '@shared/errors/application.error';

export class ${SERVICE_PASCAL}NotFoundError extends ApplicationError {
  constructor(id: string) {
    super(\`${SERVICE_PASCAL} with id \${id} not found\`);
  }
}
EOF

# Commands
cat > "$SERVICE_PATH/src/application/commands/create-${SERVICE_KEBAB}/create-${SERVICE_LOWER}.command.ts" << EOF
import { Command } from '@shared/application/command';

export class Create${SERVICE_PASCAL}Command extends Command {
  constructor(public readonly name: string) {
    super();
  }
}
EOF

cat > "$SERVICE_PATH/src/application/commands/create-${SERVICE_KEBAB}/create-${SERVICE_LOWER}.handler.ts" << EOF
import { CommandHandler } from '@shared/application/command-handler';
import { Create${SERVICE_PASCAL}Command } from './create-${SERVICE_LOWER}.command';
import { ${SERVICE_PASCAL} } from '@domain/aggregates/${SERVICE_LOWER}.aggregate';
import { ${SERVICE_PASCAL}Id } from '@domain/value-objects/${SERVICE_LOWER}-id.vo';
import { ${SERVICE_PASCAL}Repository } from '@ports/outbound/repositories/${SERVICE_LOWER}.repository';
import { v4 as uuidv4 } from 'uuid';

export class Create${SERVICE_PASCAL}Handler implements CommandHandler<Create${SERVICE_PASCAL}Command, ${SERVICE_PASCAL}> {
  constructor(private readonly ${SERVICE_LOWER}Repository: ${SERVICE_PASCAL}Repository) {}

  async execute(command: Create${SERVICE_PASCAL}Command): Promise<${SERVICE_PASCAL}> {
    const id = ${SERVICE_PASCAL}Id.create(uuidv4());
    const ${SERVICE_LOWER} = ${SERVICE_PASCAL}.create(id, command.name);

    await this.${SERVICE_LOWER}Repository.save(${SERVICE_LOWER});

    return ${SERVICE_LOWER};
  }
}
EOF

# Queries
cat > "$SERVICE_PATH/src/application/queries/get-${SERVICE_KEBAB}-by-id/get-${SERVICE_LOWER}-by-id.query.ts" << EOF
import { Query } from '@shared/application/query';

export class Get${SERVICE_PASCAL}ByIdQuery extends Query {
  constructor(public readonly id: string) {
    super();
  }
}
EOF

cat > "$SERVICE_PATH/src/application/queries/get-${SERVICE_KEBAB}-by-id/get-${SERVICE_LOWER}-by-id.handler.ts" << EOF
import { QueryHandler } from '@shared/application/query-handler';
import { Get${SERVICE_PASCAL}ByIdQuery } from './get-${SERVICE_LOWER}-by-id.query';
import { ${SERVICE_PASCAL} } from '@domain/aggregates/${SERVICE_LOWER}.aggregate';
import { ${SERVICE_PASCAL}Repository } from '@ports/outbound/repositories/${SERVICE_LOWER}.repository';
import { ${SERVICE_PASCAL}NotFoundError } from '@application/errors/${SERVICE_LOWER}-not-found.error';

export class Get${SERVICE_PASCAL}ByIdHandler implements QueryHandler<Get${SERVICE_PASCAL}ByIdQuery, ${SERVICE_PASCAL}> {
  constructor(private readonly ${SERVICE_LOWER}Repository: ${SERVICE_PASCAL}Repository) {}

  async execute(query: Get${SERVICE_PASCAL}ByIdQuery): Promise<${SERVICE_PASCAL}> {
    const ${SERVICE_LOWER} = await this.${SERVICE_LOWER}Repository.findById(query.id);

    if (!${SERVICE_LOWER}) {
      throw new ${SERVICE_PASCAL}NotFoundError(query.id);
    }

    return ${SERVICE_LOWER};
  }
}
EOF

# Integration Events
cat > "$SERVICE_PATH/src/application/integration-events/${SERVICE_LOWER}-created.integration-event.ts" << EOF
export class ${SERVICE_PASCAL}CreatedIntegrationEvent {
  constructor(
    public readonly ${SERVICE_LOWER}Id: string,
    public readonly name: string,
    public readonly createdAt: Date,
  ) {}
}
EOF

# Services
cat > "$SERVICE_PATH/src/application/services/${SERVICE_LOWER}-management.service.ts" << EOF
import { ${SERVICE_PASCAL} } from '@domain/aggregates/${SERVICE_LOWER}.aggregate';
import { ${SERVICE_PASCAL}Id } from '@domain/value-objects/${SERVICE_LOWER}-id.vo';
import { ${SERVICE_PASCAL}Repository } from '@ports/outbound/repositories/${SERVICE_LOWER}.repository';
import { Create${SERVICE_PASCAL}Dto } from '../dtos/create-${SERVICE_LOWER}.dto';
import { ${SERVICE_PASCAL}NotFoundError } from '../errors/${SERVICE_LOWER}-not-found.error';
import { v4 as uuidv4 } from 'uuid';

export class ${SERVICE_PASCAL}ManagementService {
  constructor(private readonly ${SERVICE_LOWER}Repository: ${SERVICE_PASCAL}Repository) {}

  async create(dto: Create${SERVICE_PASCAL}Dto): Promise<${SERVICE_PASCAL}> {
    const id = ${SERVICE_PASCAL}Id.create(uuidv4());
    const ${SERVICE_LOWER} = ${SERVICE_PASCAL}.create(id, dto.name);
    await this.${SERVICE_LOWER}Repository.save(${SERVICE_LOWER});
    return ${SERVICE_LOWER};
  }

  async findById(id: string): Promise<${SERVICE_PASCAL}> {
    const ${SERVICE_LOWER} = await this.${SERVICE_LOWER}Repository.findById(id);
    if (!${SERVICE_LOWER}) {
      throw new ${SERVICE_PASCAL}NotFoundError(id);
    }
    return ${SERVICE_LOWER};
  }

  async findAll(): Promise<${SERVICE_PASCAL}[]> {
    return this.${SERVICE_LOWER}Repository.findAll();
  }

  async delete(id: string): Promise<void> {
    await this.${SERVICE_LOWER}Repository.delete(id);
  }
}
EOF

# =============================================================================
# Create Ports Layer
# =============================================================================
print_info "Creating ports layer..."

# Repository Port (Outbound)
cat > "$SERVICE_PATH/src/ports/outbound/repositories/${SERVICE_LOWER}.repository.ts" << EOF
import { ${SERVICE_PASCAL} } from '@domain/aggregates/${SERVICE_LOWER}.aggregate';

export interface ${SERVICE_PASCAL}Repository {
  save(${SERVICE_LOWER}: ${SERVICE_PASCAL}): Promise<void>;
  findById(id: string): Promise<${SERVICE_PASCAL} | null>;
  findAll(): Promise<${SERVICE_PASCAL}[]>;
  delete(id: string): Promise<void>;
}
EOF

# Other Outbound Ports
cat > "$SERVICE_PATH/src/ports/outbound/event-bus.port.ts" << 'EOF'
export interface EventBusPort {
  publish<T>(event: T): Promise<void>;
  subscribe<T>(eventName: string, handler: (event: T) => Promise<void>): void;
}
EOF

cat > "$SERVICE_PATH/src/ports/outbound/id-generator.port.ts" << 'EOF'
export interface IdGeneratorPort {
  generate(): string;
}
EOF

# Controller (Inbound)
cat > "$SERVICE_PATH/src/ports/inbound/${SERVICE_LOWER}.controller.ts" << EOF
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class ${SERVICE_PASCAL}Controller {
  @GrpcMethod('${SERVICE_PASCAL}Service', 'Create${SERVICE_PASCAL}')
  async create${SERVICE_PASCAL}(data: { name: string }) {
    // TODO: Implement with service
    return {
      id: 'generated-id',
      name: data.name,
      createdAt: new Date().toISOString(),
    };
  }

  @GrpcMethod('${SERVICE_PASCAL}Service', 'Get${SERVICE_PASCAL}')
  async get${SERVICE_PASCAL}(data: { id: string }) {
    // TODO: Implement with service
    return {
      id: data.id,
      name: 'Sample ${SERVICE_PASCAL}',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  @GrpcMethod('${SERVICE_PASCAL}Service', 'List${SERVICE_PASCAL}s')
  async list${SERVICE_PASCAL}s(data: { page: number; pageSize: number }) {
    // TODO: Implement with service
    return {
      items: [],
      total: 0,
    };
  }

  @GrpcMethod('${SERVICE_PASCAL}Service', 'Update${SERVICE_PASCAL}')
  async update${SERVICE_PASCAL}(data: { id: string; name: string }) {
    // TODO: Implement with service
    return {
      id: data.id,
      name: data.name,
      updatedAt: new Date().toISOString(),
    };
  }

  @GrpcMethod('${SERVICE_PASCAL}Service', 'Delete${SERVICE_PASCAL}')
  async delete${SERVICE_PASCAL}(data: { id: string }) {
    // TODO: Implement with service
    return { success: true };
  }
}
EOF

# =============================================================================
# Create Tests
# =============================================================================
print_info "Creating test files..."

# Architecture test
cat > "$SERVICE_PATH/tests/architecture/dependency-rules.spec.ts" << EOF
describe('Architecture - Dependency Rules', () => {
  it('domain layer should not depend on application layer', () => {
    // TODO: Implement architecture test
    expect(true).toBe(true);
  });

  it('domain layer should not depend on ports layer', () => {
    // TODO: Implement architecture test
    expect(true).toBe(true);
  });

  it('application layer should not depend on ports layer', () => {
    // TODO: Implement architecture test
    expect(true).toBe(true);
  });
});
EOF

# Unit test for aggregate
cat > "$SERVICE_PATH/tests/unit/domain/${SERVICE_LOWER}.aggregate.spec.ts" << EOF
import { ${SERVICE_PASCAL} } from '../../../src/domain/aggregates/${SERVICE_LOWER}.aggregate';
import { ${SERVICE_PASCAL}Id } from '../../../src/domain/value-objects/${SERVICE_LOWER}-id.vo';

describe('${SERVICE_PASCAL} Aggregate', () => {
  describe('create', () => {
    it('should create a ${SERVICE_LOWER} with valid data', () => {
      const id = ${SERVICE_PASCAL}Id.create('test-id');
      const ${SERVICE_LOWER} = ${SERVICE_PASCAL}.create(id, 'Test ${SERVICE_PASCAL}');

      expect(${SERVICE_LOWER}.id.value).toBe('test-id');
      expect(${SERVICE_LOWER}.name).toBe('Test ${SERVICE_PASCAL}');
      expect(${SERVICE_LOWER}.domainEvents).toHaveLength(1);
    });
  });

  describe('updateName', () => {
    it('should update the name', () => {
      const id = ${SERVICE_PASCAL}Id.create('test-id');
      const ${SERVICE_LOWER} = ${SERVICE_PASCAL}.create(id, 'Original Name');

      ${SERVICE_LOWER}.updateName('Updated Name');

      expect(${SERVICE_LOWER}.name).toBe('Updated Name');
    });
  });
});
EOF

# =============================================================================
# Create .gitignore
# =============================================================================
print_info "Creating .gitignore..."
cat > "$SERVICE_PATH/.gitignore" << 'EOF'
# Dependencies
node_modules/

# Build output
dist/
build/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Test
coverage/

# Logs
logs/
*.log
npm-debug.log*

# Environment
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db
EOF

# =============================================================================
# Create Dockerfile
# =============================================================================
print_info "Creating Dockerfile..."
cat > "$SERVICE_PATH/Dockerfile" << EOF
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE ${GRPC_PORT}

CMD ["node", "dist/main"]
EOF

# =============================================================================
# Create README.md
# =============================================================================
print_info "Creating README.md..."
cat > "$SERVICE_PATH/README.md" << EOF
# $SERVICE_NAME

A microservice built with NestJS following Clean Architecture and DDD principles.

## Architecture

\`\`\`
├── src/
│   ├── application/           # Application layer
│   │   ├── commands/          # Command handlers (CQRS)
│   │   ├── queries/           # Query handlers (CQRS)
│   │   ├── dtos/              # Data Transfer Objects
│   │   ├── errors/            # Application errors
│   │   ├── integration-events/# Integration events
│   │   └── services/          # Application services
│   │
│   ├── domain/                # Domain layer (DDD)
│   │   ├── aggregates/        # Aggregate roots
│   │   ├── entities/          # Entities
│   │   ├── events/            # Domain events
│   │   ├── errors/            # Domain errors
│   │   ├── services/          # Domain services
│   │   ├── specifications/    # Specifications pattern
│   │   └── value-objects/     # Value objects
│   │
│   ├── ports/                 # Hexagonal Architecture
│   │   ├── inbound/           # Primary adapters (controllers)
│   │   └── outbound/          # Secondary adapters (repositories, etc.)
│   │
│   └── shared/                # Shared kernel
│       ├── application/       # Base application classes
│       ├── domain/            # Base domain classes
│       └── errors/            # Base errors
│
└── tests/
    ├── architecture/          # Architecture tests
    ├── integration/           # Integration tests
    └── unit/                  # Unit tests
\`\`\`

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Install dependencies

\`\`\`bash
npm install
\`\`\`

### Run the service

\`\`\`bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
\`\`\`

### Run tests

\`\`\`bash
npm test
\`\`\`

## Port

- gRPC: ${GRPC_PORT}
EOF

print_success "NestJS Clean Architecture service '$SERVICE_NAME' created successfully!"
print_info ""
print_info "Next steps:"
print_info "  1. cd $SERVICE_PATH"
print_info "  2. npm install     # Install dependencies"
print_info "  3. npm run start:dev  # Run in development mode"
