// Mirrors the backend's crags.Crag (see palabatu-be/internal/crags/repository.go
// and the generated internal_crags.Crag schema in src/types/api.d.ts) -- the
// top level of the crags -> boulders -> problems hierarchy, see handoff.md at
// the repo root: the place you drive to and park at. Lat/Lng are non-pointer
// on the Go side (required, unlike a boulder's optional point), so they're
// plain numbers here, never null.
export type Crag = {
    id: string
    name: string
    lat: number
    lng: number
    directions: string | null
    access_notes: string | null
    created_by: string | null
    created_at: string
}

// Mirrors crags.CragListItem (GET /api/crags, GET /api/crags/:id) -- Crag
// plus a creator name and boulder/problem counts, so the map's dimmed-
// empty-crag state (handoff.md open item 1) doesn't need a second
// round-trip.
export type CragListItem = Crag & {
    creator_name: string | null
    boulder_count: number
    problem_count: number
}

// Mirrors crags.CreateCragRequest / UpdateCragRequest (see
// palabatu-be/internal/crags/dto.go) -- identical shapes on the Go side,
// plain (non-pointer) strings/numbers throughout since the whole form is
// always submitted at once, never partially.
export type CragRequest = {
    name: string
    lat: number
    lng: number
    directions: string
    access_notes: string
}
