// Package apitypes holds small, generic JSON response-envelope types shared
// across domain handlers, purely for consistent responses and OpenAPI
// documentation. It has no business logic and imports nothing
// domain-specific -- domains import apitypes, never the reverse, mirroring
// the one-way shape internal/authz already establishes.
package apitypes

// SuccessResponse is the generic "the operation succeeded, nothing else to
// report" body used by delete/mark/resolve-style endpoints.
type SuccessResponse struct {
	Success bool `json:"success"`
}

// MessageResponse is the generic human-readable-confirmation body used by
// signup/verify-email/forgot-password/reset-password/change-password.
type MessageResponse struct {
	Message string `json:"message"`
}

// ErrorResponse is the body returned on every non-2xx response across every
// domain.
type ErrorResponse struct {
	Error string `json:"error"`
}

// CountResponse is the generic "just a count" body.
type CountResponse struct {
	Count int `json:"count"`
}
