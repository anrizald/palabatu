import type { Shape } from './annotation.js'

// "boulder" or "wall" (handoff.md decision 1: cliffs are in scope). Drives
// UI copy only ("which rock?" vs "which wall?", batu vs tebing) and which
// grade scale applies -- no structural difference between the two.
export type BoulderType = 'boulder' | 'wall'

// Mirrors the backend's boulders.Boulder (see
// palabatu-be/internal/boulders/repository.go and the generated
// internal_boulders.Boulder schema in src/types/api.d.ts) -- the middle
// level of the crags -> boulders -> problems hierarchy (handoff.md at the
// repo root): one rock, and the thing that owns the photo(s) every problem
// on it shares. Lat/Lng/Name/RockType are all pointer on the Go side (a
// boulder's own point and name are optional, unlike a crag's); Type is a
// plain non-pointer string on the Go side (defaults to "boulder").
export type Boulder = {
    id: string
    crag_id: string
    name: string | null
    image_urls: string[]
    type: BoulderType
    rock_type: string | null
    lat: number | null
    lng: number | null
    merged_into: string | null
    created_by: string | null
    created_at: string
}

// Mirrors boulders.BoulderListItem (GET /api/crags/:id/boulders,
// GET /api/boulders/:id) -- Boulder plus a creator name and problem count,
// so the "which rock?" photo-grid picker and the dimmed empty-boulder
// state (handoff.md open item 1) don't need a second round-trip.
// sample_problem_name backs UX principle 3's photoless-rock fallback: a
// photoless, unnamed rock identifies itself by a problem on it ("Slab
// Mantap, Sit Start") rather than a bare index -- null when it has none yet.
export type BoulderListItem = Boulder & {
    creator_name: string | null
    problem_count: number
    sample_problem_name: string | null
}

// Mirrors boulders.CreateBoulderRequest (see
// palabatu-be/internal/boulders/dto.go).
export type CreateBoulderRequest = {
    crag_id: string
    name: string
    type: BoulderType | ''
    rock_type: string
    lat: number | null
    lng: number | null
    image_urls: string[]
}

// Mirrors boulders.UpdateBoulderRequest -- no image_urls (images are only
// ever mutated via the dedicated add/delete endpoints below). crag_id
// re-parents the boulder to a different spot when non-empty (handoff.md
// decision 13); empty string means "leave as is", same convention as every
// other plain-string field here.
export type UpdateBoulderRequest = {
    crag_id: string
    name: string
    type: BoulderType | ''
    rock_type: string
    lat: number | null
    lng: number | null
}

// Mirrors boulders.AddBoulderImagesRequest / DeleteBoulderImageRequest.
export type AddBoulderImagesRequest = { image_urls: string[] }
export type DeleteBoulderImageRequest = { url: string }

// Mirrors boulders.BoulderAnnotation -- byte-for-byte the same shape as
// problems' AnnotationRecord (src/types/annotation.ts), returned by
// GET /api/boulders/:id/annotations: every problem-on-this-boulder's line,
// together (the concrete payoff of the boulder owning the photo).
export type BoulderAnnotation = {
    id: string
    problem_id: string
    image_url: string
    data: Shape[]
    updated_by: string | null
    created_at: string
    updated_at: string
}

// -- Boulder merge sub-flow (see palabatu-be/internal/boulders/merge.go and
// handoff.md's "Boulder merge flow" section: anyone signed in may suggest
// "these are the same rock", only the two boulders' own creators may
// object, only an admin executes the merge, gated by a 48h objection hold.

// Mirrors boulders.MergeRequest.
export type MergeRequest = {
    id: string
    source_boulder_id: string
    target_boulder_id: string
    suggested_by: string | null
    reason: string | null
    status: 'pending' | 'merged' | 'rejected'
    resolved_by: string | null
    resolved_at: string | null
    created_at: string
}

// Mirrors boulders.MergeObjection.
export type MergeObjection = {
    id: string
    merge_request_id: string
    user_id: string | null
    username: string | null
    body: string
    created_at: string
}

// Mirrors boulders.MergeRequestListItem -- returned by both the admin-wide
// GET /api/boulders/merge-requests and the boulder-scoped
// GET /api/boulders/:id/merge-requests, with every objection embedded so
// either review surface is one round-trip.
export type MergeRequestListItem = {
    id: string
    source_boulder_id: string
    source_boulder_name: string | null
    target_boulder_id: string
    target_boulder_name: string | null
    suggested_by: string | null
    suggester_name: string | null
    reason: string | null
    status: 'pending' | 'merged' | 'rejected'
    created_at: string
    objections: MergeObjection[]
}

// Mirrors boulders.SuggestMergeRequest / ObjectToMergeRequest /
// ResolveMergeRequestRequest.
export type SuggestMergeRequest = { target_boulder_id: string; reason: string }
export type ObjectToMergeRequest = { body: string }
export type ResolveMergeRequestRequest = { action: 'merge' | 'reject'; survivor_id: string; override_hold: boolean }
