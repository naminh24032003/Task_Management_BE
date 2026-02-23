package resilience

import (
	"errors"
	"sync"
	"time"

	"log"
)

// ─────────────────────────────────────────────────────────────
// Circuit Breaker — state machine: CLOSED → OPEN → HALF_OPEN
// ─────────────────────────────────────────────────────────────

type State int

const (
	StateClosed   State = iota
	StateOpen
	StateHalfOpen
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

	name             string
	state            State
	failureCount     int
	successCount     int
	lastFailureTime  time.Time
	halfOpenCalls    int

	failureThreshold int
	resetTimeout     time.Duration
	halfOpenMaxCalls int
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

func NewCircuitBreaker(name string, opts ...CircuitBreakerOption) *CircuitBreaker {
	cb := &CircuitBreaker{
		name:             name,
		state:            StateClosed,
		failureThreshold: 5,
		resetTimeout:     30 * time.Second,
		halfOpenMaxCalls: 1,
	}
	for _, o := range opts {
		o(cb)
	}
	return cb
}

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
	log.Printf("[CB:%s] state change: %s → %s (failures=%d)", cb.name, oldState, newState, cb.failureCount)
}

func (cb *CircuitBreaker) State() State {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}
