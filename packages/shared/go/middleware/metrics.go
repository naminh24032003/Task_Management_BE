package middleware

import (
	"context"
	"time"

	kratosMiddleware "github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/transport"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	requestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grpc_request_duration_seconds",
			Help:    "Duration of gRPC requests in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service", "operation", "status"},
	)

	requestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grpc_requests_total",
			Help: "Total number of gRPC requests",
		},
		[]string{"service", "operation", "status"},
	)

	errorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grpc_errors_total",
			Help: "Total number of gRPC errors",
		},
		[]string{"service", "operation"},
	)
)

func init() {
	prometheus.MustRegister(requestDuration, requestsTotal, errorsTotal)
}

// MetricsMiddleware returns a kratos middleware that records Prometheus metrics
// for every gRPC call: duration histogram, request counter, error counter.
func MetricsMiddleware(serviceName string) kratosMiddleware.Middleware {
	return func(handler kratosMiddleware.Handler) kratosMiddleware.Handler {
		return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
			startTime := time.Now()

			operation := "unknown"
			if tr, ok := transport.FromServerContext(ctx); ok {
				operation = tr.Operation()
			}

			reply, err = handler(ctx, req)

			duration := time.Since(startTime).Seconds()
			status := "success"
			if err != nil {
				status = "error"
				errorsTotal.WithLabelValues(serviceName, operation).Inc()
			}

			requestDuration.WithLabelValues(serviceName, operation, status).Observe(duration)
			requestsTotal.WithLabelValues(serviceName, operation, status).Inc()

			return
		}
	}
}
