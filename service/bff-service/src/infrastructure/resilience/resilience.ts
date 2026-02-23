import { Logger } from '@nestjs/common';

// ─────────────────────────────────────────────────────────────
// CircuitBreaker — state machine: CLOSED → OPEN → HALF_OPEN
//
// Same idea as Netflix Hystrix / resilience4j / sony/gobreaker
// but zero dependencies, tuned for gRPC downstream calls.
// ─────────────────────────────────────────────────────────────

export enum CircuitState {
  CLOSED = 'CLOSED',       // normal — requests pass through
  OPEN = 'OPEN',           // tripped — fast-fail immediately
  HALF_OPEN = 'HALF_OPEN', // probing — allow 1 request to test recovery
}

export interface CircuitBreakerOptions {
  /** Name for logging */
  name: string;
  /** Number of consecutive failures to trip the circuit (default: 5) */
  failureThreshold?: number;
  /** How long to stay OPEN before probing (default: 30s) */
  resetTimeoutMs?: number;
  /** Max allowed requests in HALF_OPEN to probe (default: 1) */
  halfOpenMaxCalls?: number;
  /** Called when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreaker {
  private readonly logger: Logger;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.logger = new Logger(`CB:${options.name}`);
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 1;
    this.onStateChange = options.onStateChange;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitBreakerOpenError(
        this.options.name,
        this.resetTimeoutMs - (Date.now() - this.lastFailureTime),
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN: {
        const elapsed = Date.now() - this.lastFailureTime;
        if (elapsed >= this.resetTimeoutMs) {
          this.transitionTo(CircuitState.HALF_OPEN);
          this.halfOpenCalls = 0;
          return true;
        }
        return false; // still open
      }

      case CircuitState.HALF_OPEN:
        if (this.halfOpenCalls < this.halfOpenMaxCalls) {
          this.halfOpenCalls++;
          return true;
        }
        return false; // max probes reached, wait for result
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      // Probe succeeded → close the circuit
      this.transitionTo(CircuitState.CLOSED);
      this.failureCount = 0;
      this.successCount = 0;
    } else if (this.state === CircuitState.CLOSED) {
      // Reset consecutive failure counter on success
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Probe failed → back to OPEN
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.logger.warn(`State change: ${oldState} → ${newState}`);
    this.onStateChange?.(oldState, newState);
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly serviceName: string,
    public readonly retryAfterMs: number,
  ) {
    super(`Circuit breaker [${serviceName}] is OPEN. Retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ─────────────────────────────────────────────────────────────
// Retry with exponential backoff + jitter
// ─────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Max number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 200) */
  initialDelayMs?: number;
  /** Max delay in ms (default: 5000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Jitter factor 0-1 to randomize delay (default: 0.3) */
  jitterFactor?: number;
  /** Predicate to decide if an error is retryable (default: transient errors only) */
  isRetryable?: (error: any) => boolean;
}

/** Default: only retry on transient/network gRPC errors */
function defaultIsRetryable(error: any): boolean {
  const code = error?.code;
  // gRPC retryable status codes
  const retryableCodes = [
    14, // UNAVAILABLE — server is down / network issue
    4,  // DEADLINE_EXCEEDED — timeout
    8,  // RESOURCE_EXHAUSTED — rate limited (retry after backoff)
    13, // INTERNAL — transient server error
  ];
  if (code !== undefined && retryableCodes.includes(code)) return true;

  // Network errors
  const message = error?.message?.toLowerCase() || '';
  if (message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('socket hang up')) {
    return true;
  }

  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const initialDelay = options?.initialDelayMs ?? 200;
  const maxDelay = options?.maxDelayMs ?? 5000;
  const multiplier = options?.backoffMultiplier ?? 2;
  const jitter = options?.jitterFactor ?? 0.3;
  const isRetryable = options?.isRetryable ?? defaultIsRetryable;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Exponential backoff with jitter
      const baseDelay = Math.min(initialDelay * Math.pow(multiplier, attempt), maxDelay);
      const jitterMs = baseDelay * jitter * (Math.random() * 2 - 1); // ± jitter
      const delay = Math.max(0, Math.floor(baseDelay + jitterMs));

      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
// Combined: Circuit Breaker wraps Retry
// ─────────────────────────────────────────────────────────────

export async function resilientCall<T>(
  circuitBreaker: CircuitBreaker,
  fn: () => Promise<T>,
  retryOptions?: RetryOptions,
): Promise<T> {
  return circuitBreaker.exec(() => retryWithBackoff(fn, retryOptions));
}
