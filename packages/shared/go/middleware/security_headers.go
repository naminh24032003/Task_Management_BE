package middleware

import (
	"context"
	stdhttp "net/http"

	kratosMiddleware "github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/transport"
	kratoshttp "github.com/go-kratos/kratos/v2/transport/http"
)

// securityResponseHeaders contains the full set of cache-control and security
// headers applied to every API response following enterprise HTTP standards.
//
// Cache-Control strategy:
//   - "no-store"             — response must not be stored by any cache (browser, CDN, proxy)
//   - Pragma: no-cache       — HTTP/1.0 backward compatibility
//   - Surrogate-Control      — CDN-specific cache directive (Fastly, Varnish, CloudFront)
//
// Security headers:
//   - X-Content-Type-Options — prevent MIME-sniffing attacks
//   - X-Frame-Options        — block clickjacking via iframe embedding
//   - X-XSS-Protection       — disable legacy XSS auditor (modern: rely on CSP)
//   - Referrer-Policy        — limit referrer information sent cross-origin
//   - Permissions-Policy     — restrict access to sensitive browser APIs
var securityResponseHeaders = map[string]string{
	// ── Cache Control ─────────────────────────────────────────────────────────
	"Cache-Control":     "no-store",
	"Pragma":            "no-cache",
	"Surrogate-Control": "no-store",

	// ── Security ──────────────────────────────────────────────────────────────
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options":        "DENY",
	"X-XSS-Protection":       "0",
	"Referrer-Policy":        "strict-origin-when-cross-origin",
	"Permissions-Policy":     "camera=(), microphone=(), geolocation=(), payment=()",
}

// SecurityHeadersMiddleware returns a Kratos middleware that sets enterprise
// cache-control and security response headers on every HTTP request processed
// through the Kratos router (GET/POST routes registered via srv.Route("/")).
//
// Usage in server options:
//
//	opts = append(opts, kratoshttp.Middleware(
//	    recovery.Recovery(),
//	    middleware.SecurityHeadersMiddleware(),
//	))
func SecurityHeadersMiddleware() kratosMiddleware.Middleware {
	return func(handler kratosMiddleware.Handler) kratosMiddleware.Handler {
		return func(ctx context.Context, req interface{}) (interface{}, error) {
			if tr, ok := transport.FromServerContext(ctx); ok {
				if ht, ok := tr.(kratoshttp.Transporter); ok {
					h := ht.ReplyHeader()
					for key, value := range securityResponseHeaders {
						h.Set(key, value)
					}
					// HSTS — set only when the upstream TLS terminator forwards
					// the X-Forwarded-Proto header (Kong / Nginx / ALB).
					if ht.RequestHeader().Get("X-Forwarded-Proto") == "https" {
						h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
					}
				}
			}
			return handler(ctx, req)
		}
	}
}

// WithSecurityHeaders wraps a standard net/http.Handler with enterprise
// cache-control and security response headers.
//
// Use this for raw handlers registered via srv.Handle() — those bypass the
// Kratos middleware chain and therefore need explicit wrapping.
//
// Example:
//
//	srv.Handle("/metrics", middleware.WithSecurityHeaders(promhttp.Handler()))
func WithSecurityHeaders(next stdhttp.Handler) stdhttp.Handler {
	return stdhttp.HandlerFunc(func(w stdhttp.ResponseWriter, r *stdhttp.Request) {
		h := w.Header()

		for key, value := range securityResponseHeaders {
			h.Set(key, value)
		}

		// HSTS — only set when request arrived over HTTPS
		if r.Header.Get("X-Forwarded-Proto") == "https" || r.TLS != nil {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}

		next.ServeHTTP(w, r)
	})
}
