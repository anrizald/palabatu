// The add wizard's in-progress problem-level draft ("Tell us about the
// climb" step) -- not a 1:1 backend mirror (grade is built up interactively
// by the wizard's grade picker before becoming CreateProblemRequest's
// single `grade` string; height_m stays a free-typed string here and is
// parsed to number|null on submit), same role NewProblem played
// pre-restructure. Crag/boulder selection lives in the wizard's own
// orchestration state, not here -- this is only the problem's own fields.
export type NewProblem = {
    name: string
    grade: string
    first_ascensionist: string
    discovered_by: string
    landing_hazards: string
    descent: string
    height_m: string
    notes: string
}

// Mirrors problems.CreateProblemRequest (see
// palabatu-be/internal/problems/dto.go) -- POST /api/problems's request
// body. boulder_id is required; crag_id is derived server-side from the
// boulder, never supplied directly (handoff.md decision 5).
export type CreateProblemRequest = {
    name: string
    grade: string
    boulder_id: string
    first_ascensionist: string
    discovered_by: string
    landing_hazards: string
    descent: string
    height_m: number | null
    notes: string
}

// Mirrors problems.UpdateProblemRequest -- identical shape minus
// boulder_id (not editable via update; a boulder merge, internal/boulders,
// is the only way a problem changes boulders).
export type UpdateProblemRequest = Omit<CreateProblemRequest, 'boulder_id'>

// Mirrors the backend's problems.ProblemListItem (GET /api/problems, see
// palabatu-be/internal/problems/repository.go and the generated
// internal_problems.ProblemListItem schema in src/types/api.d.ts).
// crag_id/boulder_id are always present (required on every problem); the
// rest mirror nullable Go pointer fields. No location/image fields --
// those moved to the crag/boulder (src/types/crag.ts, src/types/boulder.ts).
export type ProblemListItem = {
    id: string
    name: string
    grade: string | null
    crag_id: string
    crag_name: string | null
    boulder_id: string
    boulder_name: string | null
    first_ascensionist: string | null
    discovered_by: string | null
    landing_hazards: string | null
    descent: string | null
    height_m: number | null
    notes: string | null
    created_by: string | null
    creator_name: string | null
    creator_slug: string | null
    send_count: number
    created_at: string
}

// Mirrors problems.ProblemDetail (GET /api/problems/:id) -- identical
// field set to ProblemListItem.
export type ProblemDetail = ProblemListItem

// Mirrors problems.ProblemRow (PUT /api/problems/:id's response) -- same
// fields as ProblemDetail minus crag_name/boulder_name/creator_name/
// creator_slug/send_count (the update RETURNING clause doesn't join those).
export type ProblemRow = {
    id: string
    name: string
    grade: string | null
    crag_id: string
    boulder_id: string
    first_ascensionist: string | null
    discovered_by: string | null
    landing_hazards: string | null
    descent: string | null
    height_m: number | null
    notes: string | null
    created_by: string | null
    created_at: string
}

// Mirrors problems.ProblemSummary (see
// palabatu-be/internal/problems/repository.go) -- the shape returned by
// POST /api/problems's RETURNING clause. Deliberately a smaller field set
// than ProblemListItem/ProblemDetail (no omitempty on the Go side, so
// every key here is always present).
export type ProblemSummary = {
    id: string
    name: string
    grade: string | null
    crag_id: string
    boulder_id: string
}

// Client-side view composition, not a backend mirror -- a ProblemListItem
// enriched with its crag's coordinates and its boulder's first photo,
// resolved via src/lib/cragCache.ts's enrichProblems(). Neither is present
// on the wire response anymore (handoff.md decisions 2/4: photos live on
// the boulder, coordinates on the crag/boulder), so card/list surfaces
// that need a thumbnail or a "locate on map" target build this once after
// fetching rather than each re-deriving it.
export type EnrichedProblem = ProblemListItem & {
    thumbnailUrl: string | null
    mapLat: number | null
    mapLng: number | null
}

// Mirrors problems.TopoUploadResponse / problems.AvatarUploadResponse (see
// palabatu-be/internal/problems/dto.go) -- the two upload endpoints return
// different keys ("url" vs "avatar_url"), so they stay distinct types.
// Upload/attach/remove for boulder photos otherwise live in
// src/types/boulder.ts now -- these two entity-agnostic upload endpoints
// stayed on internal/problems.
export type TopoUploadResponse = { url: string }
export type AvatarUploadResponse = { avatar_url: string }
