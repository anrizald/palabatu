import type { BoulderType } from './boulder.js'
import type { Shape } from './annotation.js'

// Mirrors problems.CreateProblemRequest (see
// palabatu-be/internal/problems/dto.go) -- POST /api/problems's request
// body. boulder_id is required; crag_id is derived server-side from the
// boulder, never supplied directly (handoff.md decision 5). image_urls are
// optional beta/action shots (crux hold, start position, someone on it) --
// never the topo base, never annotatable (decision 2, amended).
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
    image_urls: string[]
}

// Mirrors problems.UpdateProblemRequest -- boulder_id re-parents the
// problem to a different rock when non-empty (handoff.md decision 13);
// empty string means "leave as is". No image_urls -- images mutate only
// via the dedicated add/delete endpoints below.
export type UpdateProblemRequest = {
    boulder_id: string
    name: string
    grade: string
    first_ascensionist: string
    discovered_by: string
    landing_hazards: string
    descent: string
    height_m: number | null
    notes: string
}

// Mirrors problems.AddProblemImagesRequest / DeleteProblemImageRequest.
export type AddProblemImagesRequest = { image_urls: string[] }
export type DeleteProblemImageRequest = { url: string }

// Mirrors the backend's problems.ProblemListItem (GET /api/problems, see
// palabatu-be/internal/problems/repository.go and the generated
// internal_problems.ProblemListItem schema in src/types/api.d.ts).
// crag_id/boulder_id are always present (required on every problem); the
// rest mirror nullable Go pointer fields. image_urls are beta/action shots
// -- a NEW field with a NEW meaning, not the pre-restructure topo photo
// (that lives on the boulder now, src/types/boulder.ts).
// boulder_type/topo_url/topo_line are handoff-directory.md's tier 1
// (2026-08-31): the rock's authoritative type (BoulderType is non-pointer
// on the Go side, always present), its first photo (string | null,
// replacing the per-crag fan-out enrichProblems used to need just for a
// thumbnail), and this problem's own drawn line on that photo (Go passes
// this through as an opaque json.RawMessage like auth.Profile.Title/.Tags,
// but the frontend already knows its real shape via annotation.ts's Shape,
// so it's typed precisely here rather than left opaque).
export type ProblemListItem = {
    id: string
    name: string
    grade: string | null
    crag_id: string
    crag_name: string | null
    boulder_id: string
    boulder_name: string | null
    boulder_type: BoulderType
    topo_url: string | null
    topo_line: Shape[] | null
    first_ascensionist: string | null
    discovered_by: string | null
    landing_hazards: string | null
    descent: string | null
    height_m: number | null
    notes: string | null
    image_urls: string[]
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
    image_urls: string[]
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
    image_urls: string[]
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
