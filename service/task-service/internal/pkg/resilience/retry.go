package resilience

import (
	"math"
	"math/rand"
	"time"
)

// ─────────────────────────────────────────────────────────────
// Retry — exponential backoff with jitter
//
// Retries only transient errors (caller decides via IsRetryable).
// ─────────────────────────────────────────────────────────────

type RetryConfig struct {
	MaxRetries        int
	InitialDelay      time.Duration
	MaxDelay          time.Duration
	BackoffMultiplier float64
	JitterFactor      float64
	IsRetryable       func(error) bool
}

var DefaultRetryConfig = RetryConfig{
	MaxRetries:        3,
	InitialDelay:      200 * time.Millisecond,
	MaxDelay:          5 * time.Second,
	BackoffMultiplier: 2.0,
	JitterFactor:      0.3,
	IsRetryable:       func(error) bool { return true },
}

func Retry(fn func() error, cfg RetryConfig) error {
	var lastErr error
	for attempt := 0; attempt <= cfg.MaxRetries; attempt++ {
		lastErr = fn()
		if lastErr == nil {
			return nil
		}
		if attempt >= cfg.MaxRetries || !cfg.IsRetryable(lastErr) {
			return lastErr
		}
		delay := computeDelay(attempt, cfg)
		time.Sleep(delay)
	}
	return lastErr
}

func RetryWithResult[T any](fn func() (T, error), cfg RetryConfig) (T, error) {
	var zero T
	var lastErr error
	for attempt := 0; attempt <= cfg.MaxRetries; attempt++ {
		result, err := fn()
		if err == nil {
			return result, nil
		}
		lastErr = err
		if attempt >= cfg.MaxRetries || !cfg.IsRetryable(err) {
			return zero, err
		}
		delay := computeDelay(attempt, cfg)
		time.Sleep(delay)
	}
	return zero, lastErr
}

func computeDelay(attempt int, cfg RetryConfig) time.Duration {
	base := float64(cfg.InitialDelay) * math.Pow(cfg.BackoffMultiplier, float64(attempt))
	if base > float64(cfg.MaxDelay) {
		base = float64(cfg.MaxDelay)
	}
	jitter := base * cfg.JitterFactor * (rand.Float64()*2 - 1)
	delay := base + jitter
	if delay < 0 {
		delay = 0
	}
	return time.Duration(delay)
}

// ─────────────────────────────────────────────────────────────
// Combined: Circuit Breaker wraps Retry
// ─────────────────────────────────────────────────────────────

// ResilientCall executes fn with retry inside a circuit breaker.
func ResilientCall(cb *CircuitBreaker, fn func() error, cfg RetryConfig) error {
	return cb.Exec(func() error {
		return Retry(fn, cfg)
	})
}

// ResilientCallWithResult executes fn with retry + CB and returns result.
func ResilientCallWithResult[T any](cb *CircuitBreaker, fn func() (T, error), cfg RetryConfig) (T, error) {
	return ExecWithResult(cb, func() (T, error) {
		return RetryWithResult(fn, cfg)
	})
}
