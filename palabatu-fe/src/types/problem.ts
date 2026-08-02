export type NewProblem = {
    name: string
    grade: string
    location: string
    lat: number | null
    lng: number | null
    imageFiles: File[]
    imagePreviews: string[]
}

// Mirrors the backend's problems.ProblemListItem (GET /api/problems, see
// palabatu-be/internal/problems/repository.go and the generated
// internal_problems.ProblemListItem schema in src/types/api.d.ts). None of
// its fields carry `omitempty` on the Go side, so every key is always
// present in the response — none are optional here.
export type ProblemRow = {
    id: string | number
    name: string
    location_name: string
    latitude: number
    longitude: number
    grade: string
    creator_name: string
    created_by: string
    creator_slug: string
    image_urls: string[]
    send_count: number
    created_at: string
}

// Mirrors the backend's problems.ProblemDetail (GET /api/problems/:id, see
// the generated internal_problems.ProblemDetail schema in src/types/api.d.ts).
// Same field set as ProblemRow, but nullable fields are modeled as `| null`
// to match this page's existing null-aware rendering.
export type ProblemDetail = {
    id: string
    name: string
    grade: string | null
    location_name: string | null
    latitude: number | null
    longitude: number | null
    created_by: string | null
    image_urls: string[]
    creator_name: string | null
    creator_slug: string | null
    send_count: number
    created_at: string
}

// Mirrors problems.TopoUploadResponse / problems.AvatarUploadResponse (see
// palabatu-be/internal/problems/dto.go) — the two upload endpoints return
// different keys ("url" vs "avatar_url"), so they stay distinct types.
export type TopoUploadResponse = { url: string }
export type AvatarUploadResponse = { avatar_url: string }

// Mirrors problems.ProblemSummary (see palabatu-be/internal/problems/repository.go)
// — the shape returned by POST /api/problems's RETURNING clause. Deliberately a
// different, smaller field set than ProblemRow/ProblemDetail (no omitempty on
// the Go side, so every key here is always present).
export type ProblemSummary = {
    id: string
    name: string
    grade: string | null
    location_name: string | null
    latitude: number | null
    longitude: number | null
}