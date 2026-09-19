// Shared draft/orchestration types for the add sheet (handoff.md decisions
// 11-20) -- not backend mirrors, those live in src/types/{crag,boulder,
// problem}.ts. This file only holds in-progress form state shared between
// AddSheet and its picker/field sub-components.
import type { BoulderType } from '../../types/boulder.js'
import { blankPitchForm, type PitchFormState } from '../../lib/pitches.js'

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
    /** Set once photoFile has been eagerly uploaded for draft-sync purposes
     * (handoff-drafts.md decision 10, M2) -- null whenever a new file is
     * staged, since that invalidates any previous upload. Also how a draft
     * resumed from another device carries its photo: it has this URL and no
     * local File at all (see add-sheet/drafts.ts). Submitting reuses this
     * URL instead of re-uploading when present. */
    photoUrl: string | null
}

export const blankSpot: NewSpotDraft = {
    name: '', lat: null, lng: null, accuracyM: null,
    directions: '', access_notes: '', photoFile: null, photoPreview: null, photoUrl: null,
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
    /** Index-aligned with imageFiles (handoff-drafts.md decision 10, M2):
     * null at an index means that file hasn't been eagerly uploaded yet,
     * a string means it has. Every add pushes a matching null; every
     * remove-by-index splices all three arrays together. A draft resumed
     * from another device has URLs with no matching local Files at all. */
    imageUrls: (string | null)[]
}

export const blankRock: NewRockDraft = {
    name: '', type: 'boulder', rock_type: '',
    lat: null, lng: null, accuracyM: null,
    imageFiles: [], imagePreviews: [], imageUrls: [],
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
    /** Which photo the line gets drawn on, when the rock already has one and
     * a photo is also staged here (handoff.md open item 16): 'existing'
     * draws on the rock's shared photo and files the staged shot as an extra
     * angle; 'own' draws on the staged shot instead. Meaningless (and
     * ignored) when the rock has no photo yet -- there's only one candidate
     * then. Defaults to 'existing' since reusing the shared photo is the
     * common case; bringing your own is opt-in. */
    photoChoice: 'existing' | 'own'
    /** Same role as NewSpotDraft.photoUrl (handoff-drafts.md decision 10,
     * M2) -- set once photoFile is eagerly uploaded for draft-sync, null
     * whenever a new file is staged, reused instead of re-uploading at
     * submit. */
    photoUrl: string | null
    /** Multi-pitch detail (handoff.md open item 14). Only shown, and only
     * sent, when the resolved rock is a wall; a draft saved before this
     * existed hydrates with the blank default (see drafts.ts). */
    pitch: PitchFormState
}

export const blankProblem: NewProblemDraft = {
    name: '', grade: '', first_ascensionist: '', discovered_by: '',
    landing_hazards: '', descent: '', height_m: '', notes: '',
    photoFile: null, photoPreview: null, photoChoice: 'existing', photoUrl: null,
    pitch: blankPitchForm,
}
