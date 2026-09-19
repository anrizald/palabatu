import type { PhotoCredit } from './photocredit.js'

import type { BoulderType } from './boulder.js'
import type { Shape } from './annotation.js'

// The French overall grades, plain letters with no +/- modifiers. Mirrors
// problems_commitment_grade_check (migrations/0023) and the backend's
// commitmentGrades; the list itself is COMMITMENT_GRADES in lib/constants.ts.
export type CommitmentGrade = 'F' | 'PD' | 'AD' | 'D' | 'TD' | 'ED'

// Mirrors problems.Pitch -- one documented rope-length of a multi-pitch
// route, in requests and responses alike (handoff.md open item 14). It is
// however much of the route somebody has written down and is NOT required to
// agree with the route's pitch_count. length_m is this pitch's own length and
// has nothing to do with the route's height_m. notes null and "" are the same
// thing on the way in.
export type Pitch = {
    pitch_number: number
    grade: string
    length_m: number | null
    notes: string | null
}

// Mirrors problems.CreateProblemRequest (see
// palabatu-be/internal/problems/dto.go) -- POST /api/problems's request
// body. boulder_id is required; crag_id is derived server-side from the
// boulder, never supplied directly (handoff.md decision 5). image_urls are
// optional beta/action shots (crux hold, start position, someone on it) --
// never the topo base, never annotatable (decision 2, amended). pitch_count
// (null = single pitch, otherwise 2 to 100), commitment_grade ("" = none) and
// pitches are the multi-pitch detail, accepted by the backend only when the
// boulder is a wall; pitches needs a pitch_count.
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
    pitch_count: number | null
    commitment_grade: CommitmentGrade | ''
    pitches: Pitch[]
}

// Mirrors problems.UpdateProblemRequest -- boulder_id re-parents the
// problem to a different rock when non-empty (handoff.md decision 13);
// empty string means "leave as is". No image_urls -- images mutate only
// via the dedicated add/delete endpoints below. Every field is optional and
// a key left out keeps the problem's current value: the text fields take ""
// to clear, and height_m takes null to clear (omitting it keeps it). The
// multi-pitch fields follow suit: pitch_count takes null (single pitch),
// commitment_grade takes "", and pitches, when present, replaces the whole
// documented set ([] clears it; omitting it keeps it). Clearing is always
// allowed; sending pitch detail for a route on a boulder is a 400.
export type UpdateProblemRequest = {
    boulder_id?: string
    name?: string
    grade?: string
    first_ascensionist?: string
    discovered_by?: string
    landing_hazards?: string
    descent?: string
    height_m?: number | null
    notes?: string
    pitch_count?: number | null
    commitment_grade?: CommitmentGrade | ''
    pitches?: Pitch[]
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
// boulder_type/topo_url/topo_line were added 2026-08-31: the rock's
// authoritative type (BoulderType is non-pointer on the Go side, always
// present), its first photo (string | null,
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
    pitch_count: number | null
    commitment_grade: CommitmentGrade | null
    created_by: string | null
    creator_name: string | null
    creator_slug: string | null
    send_count: number
    created_at: string
}

// Mirrors problems.ProblemDetail (GET /api/problems/:id) -- ProblemListItem
// plus the photo credits for this problem's own beta/action shots. It stopped
// being a bare alias when those arrived: the topo photo belongs to the
// boulder and carries the boulder's credits, so these two shapes are no
// longer the same field set.
export type ProblemDetail = ProblemListItem & {
    image_credits?: PhotoCredit[]
    // The documented pitches, in order; [] for a single-pitch route. Always
    // sent by GET /api/problems/:id, never by the list. Stored as-is: whether
    // to show them is the page's call (only while the rock is a wall, see
    // lib/pitches.ts), since a route moved onto a boulder keeps them hidden.
    pitches: Pitch[]
}

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
    pitch_count: number | null
    commitment_grade: CommitmentGrade | null
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
