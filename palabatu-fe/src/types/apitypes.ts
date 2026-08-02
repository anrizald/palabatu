// Mirrors palabatu-be/internal/apitypes — the shared response envelopes used
// across every domain's non-2xx (and some 2xx) responses. None of their
// fields carry `omitempty` on the Go side, so they're never optional here.
export type ErrorResponse = { error: string }
export type SuccessResponse = { success: boolean }
export type MessageResponse = { message: string }
export type CountResponse = { count: number }
