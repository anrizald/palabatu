// Mirrors the backend's approaches domain (see
// palabatu-be/internal/approaches/repository.go and the generated
// internal_approaches.* schemas in src/types/api.d.ts) -- "jalan masuk",
// the walk in, photographed step by step (handoff.md decision 21 at the
// repo root). Deliberately not a field on Crag/Boulder/Problem: a crag may
// have several genuinely different approaches.

export type StartType = 'angkot' | 'ojek' | 'motor' | 'mobil' | 'kaki'

// Mirrors approaches.ApproachStep. Lat/Lng are optional (a coordinate per
// step, not required) -- when present, the reading view can open on the
// step the user is nearest.
export type ApproachStep = {
    id: string
    approach_id: string
    position: number
    photo_url: string
    caption: string
    lat: number | null
    lng: number | null
    careful_flag: boolean
    created_at: string
}

// Mirrors approaches.Approach (GET /api/approaches/:id) -- the reading
// view's one call, steps already in order.
export type Approach = {
    id: string
    crag_id: string
    name: string | null
    start_type: StartType
    duration_minutes: number | null
    created_by: string | null
    creator_name: string | null
    created_at: string
    steps: ApproachStep[]
}

// Mirrors approaches.ApproachListItem (GET /api/crags/:id/approaches) --
// enough for the crag page's "Jalan masuk" list without fetching every
// approach's full step set. start_lat/start_lng back the map's third zoom
// layer (handoff.md open item 13) -- the first step, by position, that
// actually has a coordinate; null when none of the steps were pinned.
export type ApproachListItem = {
    id: string
    crag_id: string
    name: string | null
    start_type: StartType
    duration_minutes: number | null
    step_count: number
    first_photo_url: string | null
    start_lat: number | null
    start_lng: number | null
    created_by: string | null
    creator_name: string | null
    created_at: string
}

// Mirrors approaches.CreateApproachStepInput -- position is assigned by
// array order server-side, not a field here.
export type CreateApproachStepInput = {
    photo_url: string
    caption: string
    lat: number | null
    lng: number | null
    careful_flag: boolean
}

// Mirrors approaches.CreateApproachRequest -- the whole approach and its
// steps in one call.
export type CreateApproachRequest = {
    crag_id: string
    name: string
    start_type: StartType
    duration_minutes: number | null
    steps: CreateApproachStepInput[]
}

// Local-first labels for the start-type chips (handoff.md decision 21) --
// UI-only, not part of the wire contract.
export const START_TYPE_LABELS: Record<StartType, string> = {
    angkot: 'Turun angkot',
    ojek: 'Diantar ojek',
    motor: 'Parkir motor',
    mobil: 'Parkir mobil',
    kaki: 'Jalan kaki',
}
