// Mirrors the backend's crags.Crag (see palabatu-be/internal/crags/repository.go
// and the generated internal_crags.Crag schema in src/types/api.d.ts) -- the
// top level of the crags -> boulders -> problems hierarchy, see handoff.md at
// the repo root: the place you drive to and park at. Lat/Lng are non-pointer
// on the Go side (required, unlike a boulder's optional point), so they're
// plain numbers here, never null. ImageURLs is the approach shot -- "park
// here, the trail starts at this tree" -- never annotatable, unlike a
// boulder's.
export type Crag = {
    id: string
    name: string
    lat: number
    lng: number
    directions: string | null
    access_notes: string | null
    image_urls: string[]
    created_by: string | null
    created_at: string
}

// Mirrors crags.CragListItem (GET /api/crags, GET /api/crags/:id) -- Crag
// plus a creator name and boulder/problem/approach counts, so the map's
// dimmed-empty-crag state (handoff.md open item 1) doesn't need a second
// round-trip. approach_count is the same trick for "is there a way in
// mapped" (handoff-directory.md decision 7): every spot surface shows it,
// and none of them should have to fetch a crag's approach list to render
// one word. All three are non-pointer ints on the Go side, so never null.
export type CragListItem = Crag & {
    creator_name: string | null
    boulder_count: number
    problem_count: number
    approach_count: number
}

// Mirrors crags.UpdateCragRequest (see palabatu-be/internal/crags/dto.go) --
// plain (non-pointer) strings/numbers throughout since the whole form is
// always submitted at once, never partially. No image_urls -- images mutate
// only via the dedicated add/delete endpoints below, same split as
// boulders.
export type CragRequest = {
    name: string
    lat: number
    lng: number
    directions: string
    access_notes: string
}

// Mirrors crags.CreateCragRequest -- CragRequest plus the approach shot,
// uploadable at spot-creation time since the person is often standing right
// there (mirrors boulder.ts's CreateBoulderRequest.image_urls).
export type CreateCragRequest = CragRequest & { image_urls: string[] }

// Mirrors crags.AddCragImagesRequest / DeleteCragImageRequest.
export type AddCragImagesRequest = { image_urls: string[] }
export type DeleteCragImageRequest = { url: string }
