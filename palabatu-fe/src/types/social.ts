// Mirrors the backend's social.Comment (see palabatu-be/internal/social/repository.go
// and the generated internal_social.Comment schema in src/types/api.d.ts). None of its
// fields carry `omitempty` on the Go side, so every key is always present in the response.
export type Comment = {
    id: string
    content: string
    username: string
    created_at: string
    user_id: string
    user_slug: string
}

// Mirrors social.SendStatusResponse / social.ActionResponse (see
// palabatu-be/internal/social/handler.go) — the "has this user sent this
// problem" check and the shared toggle-send/toggle-reaction result body.
export type SendStatusResponse = { hasSent: boolean }
export type ActionResponse = { action: string }

// Mirrors social.ReactionCounts / social.ReactionStatus (see
// palabatu-be/internal/social/repository.go) — a profile's reaction tallies,
// and which of those reaction types the current user has already given.
export type ReactionType = 'like' | 'fire' | 'heart'
export type ReactionCounts = Record<ReactionType, number>
export type ReactionStatus = Record<ReactionType, boolean>
