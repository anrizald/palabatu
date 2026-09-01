// Shared draft/orchestration types for the add sheet (handoff.md decisions
// 11-20) -- not backend mirrors, those live in src/types/{crag,boulder,
// problem}.ts. This file only holds in-progress form state shared between
// AddSheet and its picker/field sub-components.
import type { BoulderType } from '../../types/boulder.js'

export type AddIntent = 'problem' | 'spot' | 'rock'

// Past this distance, "nearest spot" stops being a safe default (handoff.md
// decision 19) -- the sheet stops asserting a spot and says so instead of
// silently offering one 14 km away.
export const NEAR_M = 500

export type Geo = { lat: number; lng: number }

// Re-exported from lib/geo.ts, which now holds the one implementation these
// (and Directory/Landing/SpotList) all used their own copy of. Kept as
// re-exports rather than rewritten imports so the add sheet's own modules,
// which are handoff.md's territory, keep importing from one place.
export { haversineKm } from '../../lib/geo.js'
export { formatDistance as formatDistanceM } from '../../lib/geo.js'

// "Add a spot" draft -- name, pin (dropped on SpotMiniMap), photo, and the
// optional patokan/access fields under "More details".
export type NewSpotDraft = {
    name: string
    lat: number | null
    lng: number | null
    accuracyM: number | null
    directions: string
    access_notes: string
    photoFile: File | null
    photoPreview: string | null
}

export const blankSpot: NewSpotDraft = {
    name: '', lat: null, lng: null, accuracyM: null,
    directions: '', access_notes: '', photoFile: null, photoPreview: null,
}

// "Add a rock" draft -- photo or name required (never both, never neither;
// handoff.md decision 19), plus the boulder/wall segmented choice. The pin is
// optional and stays null unless it is deliberately placed (handoff.md open
// item 13: draw the rocks that have a coordinate, never invent one for the
// rest) -- unlike a spot's, which is required.
export type NewRockDraft = {
    name: string
    type: BoulderType
    rock_type: string
    lat: number | null
    lng: number | null
    accuracyM: number | null
    imageFiles: File[]
    imagePreviews: string[]
}

export const blankRock: NewRockDraft = {
    name: '', type: 'boulder', rock_type: '',
    lat: null, lng: null, accuracyM: null,
    imageFiles: [], imagePreviews: [],
}

// "Add a problem" draft -- name is the only required field.
export type NewProblemDraft = {
    name: string
    grade: string
    first_ascensionist: string
    discovered_by: string
    landing_hazards: string
    descent: string
    height_m: string
    notes: string
    photoFile: File | null
    photoPreview: string | null
}

export const blankProblem: NewProblemDraft = {
    name: '', grade: '', first_ascensionist: '', discovered_by: '',
    landing_hazards: '', descent: '', height_m: '', notes: '',
    photoFile: null, photoPreview: null,
}
