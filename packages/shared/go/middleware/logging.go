package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/transport"

	"go.opentelemetry.io/otel/trace"
)

// LoggingMiddleware returns a kratos middleware that logs gRPC requests and responses
// with trace context, duration, and sanitized metadata.
func LoggingMiddleware(logger log.Logger) middleware.Middleware {
	helper := log.NewHelper(log.With(logger, "module", "middleware/logging"))

	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
			startTime := time.Now()

			operation := "unknown"
			if tr, ok := transport.FromServerContext(ctx); ok {
				operation = tr.Operation()
			}

			// Extract trace ID from OpenTelemetry context
			traceID := ""
			spanCtx := trace.SpanContextFromContext(ctx)
			if spanCtx.HasTraceID() {
				traceID = spanCtx.TraceID().String()
			}

			helper.WithContext(ctx).Infow(
				"event", "grpc_request",
				"operation", operation,
				"traceId", traceID,
			)

			reply, err = handler(ctx, req)

			duration := time.Since(startTime)
			status := "success"
			if err != nil {
				status = "error"
			}

			fields := []interface{}{
				"event", "grpc_response",
				"operation", operation,
				"traceId", traceID,
				"durationMs", fmt.Sprintf("%.2f", float64(duration.Microseconds())/1000.0),
				"status", status,
			}

			if err != nil {
				fields = append(fields, "error", err.Error())
				helper.WithContext(ctx).Errorw(fields...)
			} else {
				helper.WithContext(ctx).Infow(fields...)
			}

			return
		}
	}
}
