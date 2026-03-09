/**
 * env.validation.ts
 *
 * Boot-time environment variable validation.
 * Throws a descriptive error and terminates the process if any required variable
 * is missing or has an invalid value — BEFORE any module initializes.
 *
 * Zero extra dependencies: uses only Node.js built-ins.
 * Pass this function to ConfigModule.forRoot({ validate }) in AppModule.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type EnvRecord = Record<string, string | undefined>;

interface ValidationError {
  variable: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator helpers
// ─────────────────────────────────────────────────────────────────────────────

function requiredString(
  env: EnvRecord,
  key: string,
  errors: ValidationError[],
): string {
  const value = env[key];
  if (!value || value.trim() === '') {
    errors.push({ variable: key, message: `must be a non-empty string` });
    return '';
  }
  return value;
}

function optionalPort(
  env: EnvRecord,
  key: string,
  defaultValue: number,
  errors: ValidationError[],
): number {
  const raw = env[key];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
    errors.push({ variable: key, message: `must be a valid port number (1–65535), got "${raw}"` });
    return defaultValue;
  }
  return parsed;
}

function optionalEnum<T extends string>(
  env: EnvRecord,
  key: string,
  allowed: T[],
  defaultValue: T,
  errors: ValidationError[],
): T {
  const raw = env[key];
  if (!raw) return defaultValue;
  if (!allowed.includes(raw as T)) {
    errors.push({
      variable: key,
      message: `must be one of [${allowed.join(', ')}], got "${raw}"`,
    });
    return defaultValue;
  }
  return raw as T;
}

function optionalPositiveInt(
  env: EnvRecord,
  key: string,
  defaultValue: number,
  errors: ValidationError[],
): number {
  const raw = env[key];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 1) {
    errors.push({ variable: key, message: `must be a positive integer, got "${raw}"` });
    return defaultValue;
  }
  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validated config shape
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidatedEnv {
  // App
  NODE_ENV: 'development' | 'staging' | 'production' | 'test';
  APP_PORT: number;
  APP_METRICS_PORT: number;
  CORS_ORIGINS: string;

  // Auth
  JWT_SECRET: string;
  AUTH_MODE: 'kong' | 'standalone';
  JWT_EXPIRES_IN: number;

  // gRPC
  GRPC_USER_SERVICE_URL: string;
  GRPC_TASK_SERVICE_URL: string;

  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;

  // GraphQL
  GRAPHQL_MAX_DEPTH: number;
  GRAPHQL_MAX_COMPLEXITY: number;
  GRAPHQL_MAX_TOKENS: number;
}

/**
 * Validate process.env at startup.
 * ConfigModule calls this with the merged env; throw/process.exit to abort boot.
 */
export function validateEnv(env: EnvRecord): ValidatedEnv {
  const errors: ValidationError[] = [];

  const NODE_ENV = optionalEnum(
    env, 'NODE_ENV',
    ['development', 'staging', 'production', 'test'],
    'development',
    errors,
  );

  const APP_PORT         = optionalPort(env, 'APP_PORT',         4000, errors);
  const APP_METRICS_PORT = optionalPort(env, 'APP_METRICS_PORT', 9092, errors);
  const CORS_ORIGINS     = env.CORS_ORIGINS ?? 'http://localhost:3000';

  // In production, JWT_SECRET must be non-default
  let JWT_SECRET = env.JWT_SECRET ?? '';
  if (NODE_ENV === 'production') {
    // Required AND must not be the well-known placeholder
    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key' || JWT_SECRET.length < 32) {
      errors.push({
        variable: 'JWT_SECRET',
        message: 'must be set to a strong random value (≥32 chars) in production',
      });
    }
  } else {
    if (!JWT_SECRET) {
      JWT_SECRET = 'dev-insecure-secret';
    }
  }
  // Non-production: use fallback but log a warning (done below)

  const AUTH_MODE = optionalEnum(
    env, 'AUTH_MODE',
    ['kong', 'standalone'],
    'kong',
    errors,
  );

  const JWT_EXPIRES_IN = optionalPositiveInt(env, 'JWT_EXPIRES_IN', 3600, errors);

  // gRPC URLs — required in non-test environments
  let GRPC_USER_SERVICE_URL = env.GRPC_USER_SERVICE_URL ?? '';
  let GRPC_TASK_SERVICE_URL = env.GRPC_TASK_SERVICE_URL ?? '';

  if (NODE_ENV !== 'test') {
    if (!GRPC_USER_SERVICE_URL) {
      errors.push({ variable: 'GRPC_USER_SERVICE_URL', message: 'must be set (e.g. "user-service:50051")' });
    }
    if (!GRPC_TASK_SERVICE_URL) {
      errors.push({ variable: 'GRPC_TASK_SERVICE_URL', message: 'must be set (e.g. "task-service:50052")' });
    }
  } else {
    GRPC_USER_SERVICE_URL = GRPC_USER_SERVICE_URL || 'localhost:50051';
    GRPC_TASK_SERVICE_URL = GRPC_TASK_SERVICE_URL || 'localhost:50052';
  }

  const REDIS_HOST = env.REDIS_HOST ?? 'localhost';
  const REDIS_PORT = optionalPort(env, 'REDIS_PORT', 6379, errors);

  // In production, Redis host must be explicitly set (not relying on default)
  if (NODE_ENV === 'production' && (!env.REDIS_HOST || env.REDIS_HOST === 'localhost')) {
    errors.push({
      variable: 'REDIS_HOST',
      message: 'must be set to a real Redis host in production (not "localhost")',
    });
  }

  const GRAPHQL_MAX_DEPTH      = optionalPositiveInt(env, 'GRAPHQL_MAX_DEPTH',      10,   errors);
  const GRAPHQL_MAX_COMPLEXITY = optionalPositiveInt(env, 'GRAPHQL_MAX_COMPLEXITY',  200,  errors);
  const GRAPHQL_MAX_TOKENS     = optionalPositiveInt(env, 'GRAPHQL_MAX_TOKENS',      1000, errors);

  // ── Report and abort ───────────────────────────────────────────────────────
  if (errors.length > 0) {
    const lines = errors.map((e) => `  ✗  ${e.variable}: ${e.message}`).join('\n');
    console.error(
      `\n[Config Validation] ${errors.length} error(s) found — refusing to start:\n${lines}\n`,
    );
    process.exit(1);
  }

  // Warn about development-only defaults
  if (NODE_ENV !== 'production' && (!env.JWT_SECRET || env.JWT_SECRET === JWT_SECRET)) {
    console.warn('[Config Validation] JWT_SECRET is using an insecure default — DO NOT use in production.');
  }

  return {
    NODE_ENV,
    APP_PORT,
    APP_METRICS_PORT,
    CORS_ORIGINS,
    JWT_SECRET,
    AUTH_MODE,
    JWT_EXPIRES_IN,
    GRPC_USER_SERVICE_URL,
    GRPC_TASK_SERVICE_URL,
    REDIS_HOST,
    REDIS_PORT,
    GRAPHQL_MAX_DEPTH,
    GRAPHQL_MAX_COMPLEXITY,
    GRAPHQL_MAX_TOKENS,
  };
}
