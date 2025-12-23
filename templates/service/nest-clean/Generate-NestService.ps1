# =============================================================================
# NestJS Clean Architecture Service Generator (PowerShell)
# Based on user-service architecture (Clean Architecture + DDD + Hexagonal)
# =============================================================================

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$ServiceName,
    
    [Parameter()]
    [string]$Directory = "./service",
    
    [Parameter()]
    [string]$Port = "50051"
)

# Colors
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-ErrorMsg { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Convert names
$ServiceShort = $ServiceName -replace '-service$', ''
$ServicePascal = ($ServiceShort -split '-' | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) }) -join ''
$ServiceLower = $ServiceShort.ToLower()
$ServiceKebab = $ServiceShort.ToLower() -replace '_', '-'

$ServicePath = Join-Path $Directory $ServiceName

Write-Info "Creating NestJS Clean Architecture service: $ServiceName"
Write-Info "Target directory: $ServicePath"

# Check if exists
if (Test-Path $ServicePath) {
    Write-ErrorMsg "Directory $ServicePath already exists!"
    exit 1
}

# Create directories
Write-Info "Creating directory structure..."

$dirs = @(
    "src/application/commands/create-$ServiceKebab",
    "src/application/commands/update-$ServiceKebab",
    "src/application/commands/delete-$ServiceKebab",
    "src/application/queries/get-$ServiceKebab-by-id",
    "src/application/queries/list-${ServiceKebab}s",
    "src/application/dtos",
    "src/application/errors",
    "src/application/integration-events",
    "src/application/services",
    "src/domain/aggregates",
    "src/domain/entities",
    "src/domain/errors",
    "src/domain/events",
    "src/domain/services",
    "src/domain/specifications",
    "src/domain/value-objects",
    "src/ports/inbound/commands",
    "src/ports/inbound/queries",
    "src/ports/outbound/repositories",
    "src/shared/application",
    "src/shared/domain",
    "src/shared/errors",
    "tests/architecture",
    "tests/integration/commands",
    "tests/integration/queries",
    "tests/unit/application",
    "tests/unit/domain"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path (Join-Path $ServicePath $dir) -Force | Out-Null
}

Write-Success "Directory structure created!"

# =============================================================================
# Create package.json
# =============================================================================
Write-Info "Creating package.json..."
$packageJson = @"
{
  "name": "$ServiceName",
  "version": "0.0.1",
  "description": "$ServicePascal service with Clean Architecture",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,tests}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage"
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
    "@types/jest": "^29.5.2",
    "@types/node": "^20.3.1",
    "@types/uuid": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.42.0",
    "jest": "^29.5.0",
    "prettier": "^3.0.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.1.3"
  }
}
"@
$packageJson | Out-File -FilePath (Join-Path $ServicePath "package.json") -Encoding utf8

# =============================================================================
# Create tsconfig.json
# =============================================================================
Write-Info "Creating tsconfig.json..."
$tsConfig = @'
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
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"],
      "@ports/*": ["src/ports/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
'@
$tsConfig | Out-File -FilePath (Join-Path $ServicePath "tsconfig.json") -Encoding utf8

# =============================================================================
# Create nest-cli.json
# =============================================================================
Write-Info "Creating nest-cli.json..."
$nestCli = @'
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": ["**/*.proto"]
  }
}
'@
$nestCli | Out-File -FilePath (Join-Path $ServicePath "nest-cli.json") -Encoding utf8

# =============================================================================
# Create jest.config.js
# =============================================================================
Write-Info "Creating jest.config.js..."
$jestConfig = @'
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@ports/(.*)$': '<rootDir>/src/ports/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },
};
'@
$jestConfig | Out-File -FilePath (Join-Path $ServicePath "jest.config.js") -Encoding utf8

# =============================================================================
# Create main.ts
# =============================================================================
Write-Info "Creating src/main.ts..."
$mainTs = @"
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: '$ServiceLower',
      protoPath: join(__dirname, '$ServiceLower.proto'),
      url: 'localhost:$Port',
    },
  });

  app.enableShutdownHooks();
  await app.listen();
  console.log('$ServicePascal Service is listening on localhost:$Port');
}

bootstrap();
"@
$mainTs | Out-File -FilePath (Join-Path $ServicePath "src/main.ts") -Encoding utf8

# =============================================================================
# Create app.module.ts
# =============================================================================
Write-Info "Creating src/app.module.ts..."
$appModule = @"
import { Module } from '@nestjs/common';
import { ${ServicePascal}Controller } from './ports/inbound/$ServiceLower.controller';

@Module({
  imports: [],
  controllers: [${ServicePascal}Controller],
  providers: [],
})
export class AppModule {}
"@
$appModule | Out-File -FilePath (Join-Path $ServicePath "src/app.module.ts") -Encoding utf8

# =============================================================================
# Create proto file
# =============================================================================
Write-Info "Creating src/$ServiceLower.proto..."
$proto = @"
syntax = "proto3";

package $ServiceLower;

service ${ServicePascal}Service {
  rpc Create${ServicePascal}(Create${ServicePascal}Request) returns (Create${ServicePascal}Response);
  rpc Get${ServicePascal}(Get${ServicePascal}Request) returns (Get${ServicePascal}Response);
  rpc List${ServicePascal}s(List${ServicePascal}sRequest) returns (List${ServicePascal}sResponse);
  rpc Update${ServicePascal}(Update${ServicePascal}Request) returns (Update${ServicePascal}Response);
  rpc Delete${ServicePascal}(Delete${ServicePascal}Request) returns (Delete${ServicePascal}Response);
}

message Create${ServicePascal}Request { string name = 1; }
message Create${ServicePascal}Response { string id = 1; string name = 2; string created_at = 3; }

message Get${ServicePascal}Request { string id = 1; }
message Get${ServicePascal}Response { string id = 1; string name = 2; string created_at = 3; string updated_at = 4; }

message List${ServicePascal}sRequest { int32 page = 1; int32 page_size = 2; }
message List${ServicePascal}sResponse { repeated Get${ServicePascal}Response items = 1; int32 total = 2; }

message Update${ServicePascal}Request { string id = 1; string name = 2; }
message Update${ServicePascal}Response { string id = 1; string name = 2; string updated_at = 3; }

message Delete${ServicePascal}Request { string id = 1; }
message Delete${ServicePascal}Response { bool success = 1; }
"@
$proto | Out-File -FilePath (Join-Path $ServicePath "src/$ServiceLower.proto") -Encoding utf8

# =============================================================================
# Create Domain Layer
# =============================================================================
Write-Info "Creating domain layer..."

# Aggregate
$aggregate = @"
import { AggregateRoot } from '@shared/domain/aggregate-root';
import { ${ServicePascal}Id } from '../value-objects/$ServiceLower-id.vo';
import { ${ServicePascal}CreatedEvent } from '../events/$ServiceLower-created.event';

export interface ${ServicePascal}Props {
  id: ${ServicePascal}Id;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class $ServicePascal extends AggregateRoot<${ServicePascal}Props> {
  private constructor(props: ${ServicePascal}Props) { super(props); }

  public static create(id: ${ServicePascal}Id, name: string): $ServicePascal {
    const now = new Date();
    const entity = new $ServicePascal({ id, name, createdAt: now, updatedAt: now });
    entity.addDomainEvent(new ${ServicePascal}CreatedEvent(id.value, name, now));
    return entity;
  }

  public get id(): ${ServicePascal}Id { return this.props.id; }
  public get name(): string { return this.props.name; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public updateName(name: string): void {
    this.props.name = name;
    this.props.updatedAt = new Date();
  }
}
"@
$aggregate | Out-File -FilePath (Join-Path $ServicePath "src/domain/aggregates/$ServiceLower.aggregate.ts") -Encoding utf8

# Value Object
$valueObject = @"
import { ValueObject } from '@shared/domain/value-object';

interface ${ServicePascal}IdProps { value: string; }

export class ${ServicePascal}Id extends ValueObject<${ServicePascal}IdProps> {
  private constructor(props: ${ServicePascal}IdProps) { super(props); }

  public static create(id: string): ${ServicePascal}Id {
    if (!id || id.trim().length === 0) {
      throw new Error('$ServicePascal ID cannot be empty');
    }
    return new ${ServicePascal}Id({ value: id });
  }

  public get value(): string { return this.props.value; }
  protected validate(): void {
    if (!this.props.value) throw new Error('$ServicePascal ID is required');
  }
}
"@
$valueObject | Out-File -FilePath (Join-Path $ServicePath "src/domain/value-objects/$ServiceLower-id.vo.ts") -Encoding utf8

# Domain Event
$domainEvent = @"
import { DomainEvent } from '@shared/domain/domain-event';

export class ${ServicePascal}CreatedEvent extends DomainEvent {
  constructor(
    public readonly entityId: string,
    public readonly name: string,
    public readonly occurredAt: Date,
  ) { super(); }

  eventName(): string { return '$ServiceLower.created'; }
}
"@
$domainEvent | Out-File -FilePath (Join-Path $ServicePath "src/domain/events/$ServiceLower-created.event.ts") -Encoding utf8

# =============================================================================
# Create Shared Layer
# =============================================================================
Write-Info "Creating shared layer..."

$aggregateRoot = @'
import { DomainEvent } from './domain-event';

export abstract class AggregateRoot<T> {
  protected props: T;
  private _domainEvents: DomainEvent[] = [];

  protected constructor(props: T) { this.props = props; }

  get domainEvents(): DomainEvent[] { return this._domainEvents; }
  protected addDomainEvent(event: DomainEvent): void { this._domainEvents.push(event); }
  public clearEvents(): void { this._domainEvents = []; }
}
'@
$aggregateRoot | Out-File -FilePath (Join-Path $ServicePath "src/shared/domain/aggregate-root.ts") -Encoding utf8

$valueObjectBase = @'
export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
    this.validate();
  }

  protected abstract validate(): void;

  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) return false;
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
'@
$valueObjectBase | Out-File -FilePath (Join-Path $ServicePath "src/shared/domain/value-object.ts") -Encoding utf8

$domainEventBase = @'
export abstract class DomainEvent {
  public readonly occurredOn: Date;
  protected constructor() { this.occurredOn = new Date(); }
  abstract eventName(): string;
}
'@
$domainEventBase | Out-File -FilePath (Join-Path $ServicePath "src/shared/domain/domain-event.ts") -Encoding utf8

$baseError = @'
export abstract class BaseError extends Error {
  public readonly code: string;
  protected constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
  }
}
'@
$baseError | Out-File -FilePath (Join-Path $ServicePath "src/shared/errors/base.error.ts") -Encoding utf8

# =============================================================================
# Create Ports Layer
# =============================================================================
Write-Info "Creating ports layer..."

# Repository - use string concatenation to avoid colon issue
$repoContent = "import { $ServicePascal } from '@domain/aggregates/$ServiceLower.aggregate';

export interface ${ServicePascal}Repository {
  save(entity: $ServicePascal): Promise<void>;
  findById(id: string): Promise<$ServicePascal | null>;
  findAll(): Promise<${ServicePascal}[]>;
  delete(id: string): Promise<void>;
}"
$repoContent | Out-File -FilePath (Join-Path $ServicePath "src/ports/outbound/repositories/$ServiceLower.repository.ts") -Encoding utf8

# Controller
$controller = @"
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class ${ServicePascal}Controller {
  @GrpcMethod('${ServicePascal}Service', 'Create$ServicePascal')
  async createEntity(data: { name: string }) {
    return { id: 'generated-id', name: data.name, createdAt: new Date().toISOString() };
  }

  @GrpcMethod('${ServicePascal}Service', 'Get$ServicePascal')
  async getEntity(data: { id: string }) {
    return { id: data.id, name: 'Sample', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }

  @GrpcMethod('${ServicePascal}Service', 'List${ServicePascal}s')
  async listEntities(data: { page: number; pageSize: number }) {
    return { items: [], total: 0 };
  }

  @GrpcMethod('${ServicePascal}Service', 'Update$ServicePascal')
  async updateEntity(data: { id: string; name: string }) {
    return { id: data.id, name: data.name, updatedAt: new Date().toISOString() };
  }

  @GrpcMethod('${ServicePascal}Service', 'Delete$ServicePascal')
  async deleteEntity(data: { id: string }) {
    return { success: true };
  }
}
"@
$controller | Out-File -FilePath (Join-Path $ServicePath "src/ports/inbound/$ServiceLower.controller.ts") -Encoding utf8

# =============================================================================
# Create .gitignore & README
# =============================================================================
Write-Info "Creating .gitignore and README..."

$gitignore = @'
node_modules/
dist/
coverage/
.idea/
.vscode/
*.log
.env
.DS_Store
'@
$gitignore | Out-File -FilePath (Join-Path $ServicePath ".gitignore") -Encoding utf8

$readme = @"
# $ServiceName

NestJS service with Clean Architecture + DDD + Hexagonal

## Structure

- src/
  - application/  - Commands, Queries, DTOs (CQRS)
  - domain/       - Aggregates, Events, Value Objects (DDD)
  - ports/        - Inbound/Outbound (Hexagonal)
  - shared/       - Base classes

## Commands

```
npm install        # Install deps
npm run start:dev  # Run dev
npm run build      # Build
npm test           # Run tests
```

## Port: $Port
"@
$readme | Out-File -FilePath (Join-Path $ServicePath "README.md") -Encoding utf8

Write-Success "NestJS service '$ServiceName' created successfully!"
Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. cd $ServicePath"
Write-Host "  2. npm install"
Write-Host "  3. npm run start:dev"
