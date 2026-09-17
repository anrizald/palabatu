// Mirrors the backend's drafts domain (see palabatu-be/internal/drafts and
// the generated internal_drafts.* schemas in src/types/api.d.ts) --
// backend sync for the add sheet's autosave feature (handoff-drafts.md
// Milestone 2). payload stays untyped on this side too: it's a direct
// snapshot of AddSheetDraft's own JSON-safe fields (see add-sheet/drafts.ts),
// which this mirror has no reason to re-describe.
export type DraftIntent = 'problem' | 'spot' | 'rock'

// Mirrors drafts.DraftListItem (GET /api/drafts) -- enough for the drafts
// overlay's rows without shipping every draft's full payload. thumbnail_url
// is photo_urls[1] server-side, not the opaque payload.
export type DraftListItem = {
    id: string
    intent: DraftIntent
    label: string
    thumbnail_url: string | null
    updated_at: string
}

// Mirrors drafts.Draft (GET/POST/PUT /api/drafts) -- the full row, fetched
// when resuming one.
export type DraftRecord = {
    id: string
    intent: DraftIntent
    label: string
    payload: unknown
    photo_urls: string[]
    created_at: string
    updated_at: string
}

// Mirrors drafts.CreateDraftRequest / drafts.UpdateDraftRequest -- one
// shape covers both, matching the Go request bodies' identical fields
// (create additionally sends intent, which never changes after creation).
export type DraftWriteRequest = {
    intent?: DraftIntent
    label: string
    payload: unknown
    photo_urls: string[]
}
