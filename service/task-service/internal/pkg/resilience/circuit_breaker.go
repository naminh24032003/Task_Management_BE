package resilience

import (
	"errors"
	"sync"
	"time"

	"github.com/go-kratos/kratos/v2/log"
)

// ─────────────────────────────────────────────────────────────
// Circuit Breaker — state machine: CLOSED → OPEN → HALF_OPEN
//
// Zero external dependencies — pure Go implementation.
// When the downstream (e.g. Redis) fails enough times, the
// circuit trips OPEN and fast-fails to protect the caller.
// ─────────────────────────────────────────────────────────────

type State int

const (
	StateClosed   State = iota // normal — requests pass through
	StateOpen                  // tripped — fast-fail immediately
	StateHalfOpen              // probing — allow limited requests
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateOpen:
		return "OPEN"
	case StateHalfOpen:
		return "HALF_OPEN"
	default:
		return "UNKNOWN"
	}
}

var ErrCircuitOpen = errors.New("circuit breaker is OPEN")

type CircuitBreakerOption func(*CircuitBreaker)

type CircuitBreaker struct {
	mu sync.Mutex

	name            string
	state           State
	failureCount    int
	successCount    int
	lastFailureTime time.Time
	halfOpenCalls   int

	failureThreshold int
	resetTimeout     time.Duration
	halfOpenMaxCalls int

	logger *log.Helper
}

func WithFailureThreshold(n int) CircuitBreakerOption {
	return func(cb *CircuitBreaker) { cb.failureThreshold = n }
}

func WithResetTimeout(d time.Duration) CircuitBreakerOption {
	return func(cb *CircuitBreaker) { cb.resetTimeout = d }
}

func WithHalfOpenMaxCalls(n int) CircuitBreakerOption {
	return func(cb *CircuitBreaker) { cb.halfOpenMaxCalls = n }
}

func NewCircuitBreaker(name string, logger log.Logger, opts ...CircuitBreakerOption) *CircuitBreaker {
	cb := &CircuitBreaker{
		name:             name,
		state:            StateClosed,
		failureThreshold: 5,
		resetTimeout:     30 * time.Second,
		halfOpenMaxCalls: 1,
		logger:           log.NewHelper(log.With(logger, "component", "circuit-breaker", "name", name)),
	}
	for _, o := range opts {
		o(cb)
	}
	return cb
}

// Exec wraps a function call with circuit breaker protection.
// Returns ErrCircuitOpen immediately if the circuit is tripped.
func (cb *CircuitBreaker) Exec(fn func() error) error {
	if !cb.canExecute() {
		return ErrCircuitOpen
	}
	err := fn()
	if err != nil {
		cb.onFailure()
	} else {
		cb.onSuccess()
	}
	return err
}

// ExecWithResult wraps a function that returns a value.
func ExecWithResult[T any](cb *CircuitBreaker, fn func() (T, error)) (T, error) {
	var zero T
	if !cb.canExecute() {
		return zero, ErrCircuitOpen
	}
	result, err := fn()
	if err != nil {
		cb.onFailure()
	} else {
		cb.onSuccess()
	}
	return result, err
}

func (cb *CircuitBreaker) canExecute() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		return true

	case StateOpen:
		if time.Since(cb.lastFailureTime) >= cb.resetTimeout {
			cb.transitionTo(StateHalfOpen)
			cb.halfOpenCalls = 0
			return true
		}
		return false

	case StateHalfOpen:
		if cb.halfOpenCalls < cb.halfOpenMaxCalls {
			cb.halfOpenCalls++
			return true
		}
		return false
	}
	return false
}

func (cb *CircuitBreaker) onSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateHalfOpen:
		cb.successCount++
		cb.transitionTo(StateClosed)
		cb.failureCount = 0
		cb.successCount = 0
	case StateClosed:
		cb.failureCount = 0
	}
}

func (cb *CircuitBreaker) onFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.lastFailureTime = time.Now()

	switch cb.state {
	case StateHalfOpen:
		cb.transitionTo(StateOpen)
	case StateClosed:
		cb.failureCount++
		if cb.failureCount >= cb.failureThreshold {
			cb.transitionTo(StateOpen)
		}
	}
}

func (cb *CircuitBreaker) transitionTo(newState State) {
	oldState := cb.state
	cb.state = newState
	cb.logger.Warnf("state change: %s → %s (failures=%d)", oldState, newState, cb.failureCount)
}

// State returns the current state (thread-safe).
func (cb *CircuitBreaker) State() State {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}

// Stats returns diagnostic info.
func (cb *CircuitBreaker) Stats() map[string]interface{} {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return map[string]interface{}{
		"name":            cb.name,
		"state":           cb.state.String(),
		"failureCount":    cb.failureCount,
		"lastFailureTime": cb.lastFailureTime,
	}
}
