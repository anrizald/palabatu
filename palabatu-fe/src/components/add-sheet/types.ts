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

// Great-circle distance in km. Own copy rather than a shared lib module --
// mirrors the precedent already established between Directory.tsx and
// Landing.tsx's identical helpers (each page's geo need is small enough
// that the indirection isn't worth it yet).
export function haversineKm(a: Geo, b: Geo): number {
    const R = 6371
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(s))
}

export function formatDistanceM(km: number): string {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

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
// handoff.md decision 19), plus the boulder/wall segmented choice.
export type NewRockDraft = {
    name: string
    type: BoulderType
    rock_type: string
    imageFiles: File[]
    imagePreviews: string[]
}

export const blankRock: NewRockDraft = { name: '', type: 'boulder', rock_type: '', imageFiles: [], imagePreviews: [] }

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
