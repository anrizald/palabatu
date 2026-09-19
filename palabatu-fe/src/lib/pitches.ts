// Form state and request-building for a multi-pitch route's detail (handoff.md
// open item 14, decision 23), shared by the add sheet and the problem page's
// edit form so the two cannot drift.
//
// The form keeps everything as strings, the way the height field does, and
// turns it into numbers only in pitchFormToCreate/-Update. A route with a
// blank pitch count is a single pitch: null is the one way to say so, and 0 or
// 1 is never sent (the backend 400s on it).
import { MAX_PITCH_COUNT } from './constants.js'
import type { BoulderType } from '../types/boulder.js'
import type { CommitmentGrade, CreateProblemRequest, Pitch, UpdateProblemRequest } from '../types/problem.js'

export type PitchFormRow = {
    pitch_number: string
    grade: string
    length_m: string
    notes: string
}

export type PitchFormState = {
    /** '' means single pitch. */
    pitch_count: string
    commitment_grade: CommitmentGrade | ''
    pitches: PitchFormRow[]
}

export const blankPitchForm: PitchFormState = { pitch_count: '', commitment_grade: '', pitches: [] }

export const COMMITMENT_HELP =
    "Commitment grade: how serious the whole route is, not just its hardest move. "
    + "Length, how hard it is to retreat, and how remote it is all count. "
    + "Runs from F (easy) to ED (extremely hard). Leave it blank if you're not sure."

/**
 * Whether a route's pitch detail should be shown at all. It is only ever
 * shown on a wall (CLAUDE.md: boulders.type gates anything derived from a
 * problem's own columns): a route moved onto a boulder keeps its stored pitch
 * detail, hidden, and gets it back if it returns to a wall. An unknown rock
 * type, because the boulder has not loaded yet, counts as not a wall.
 */
export function showsPitchDetail(rockType: BoulderType | null | undefined, pitchCount: number | null): boolean {
    return rockType === 'wall' && pitchCount != null
}

export function pitchFormFromProblem(p: {
    pitch_count: number | null
    commitment_grade: CommitmentGrade | null
    pitches?: Pitch[]
}): PitchFormState {
    return {
        pitch_count: p.pitch_count != null ? String(p.pitch_count) : '',
        commitment_grade: p.commitment_grade ?? '',
        pitches: (p.pitches ?? []).map(x => ({
            pitch_number: String(x.pitch_number),
            grade: x.grade,
            length_m: x.length_m != null ? String(x.length_m) : '',
            notes: x.notes ?? '',
        })),
    }
}

/** True when the form holds anything a person typed -- for the add sheet's
 * "is there unsaved input" check. */
export function pitchFormIsDirty(f: PitchFormState): boolean {
    return f.pitch_count.trim() !== '' || f.commitment_grade !== '' || f.pitches.length > 0
}

/** The next unused pitch number, for a freshly added row. */
export function nextPitchNumber(rows: PitchFormRow[]): number {
    return rows.reduce((max, r) => Math.max(max, Number(r.pitch_number) || 0), 0) + 1
}

/**
 * The first thing wrong with the form, as a sentence a climber can act on, or
 * null when it is fine. Rows are only checked while a pitch count is set,
 * because that is the only time they are shown or sent.
 */
export function pitchFormError(f: PitchFormState): string | null {
    if (f.pitch_count.trim() === '') return null
    const count = Number(f.pitch_count)
    if (!Number.isInteger(count) || count < 2 || count > MAX_PITCH_COUNT) {
        return `The pitch count has to be between 2 and ${MAX_PITCH_COUNT}. Leave it blank for a single pitch.`
    }
    const seen = new Set<number>()
    for (const [i, row] of f.pitches.entries()) {
        const n = Number(row.pitch_number)
        if (!Number.isInteger(n) || n < 1 || n > MAX_PITCH_COUNT) return `Pitch ${i + 1}: the pitch number has to be a whole number from 1 to ${MAX_PITCH_COUNT}.`
        if (seen.has(n)) return `Two pitches are numbered ${n}. Give each one its own number.`
        seen.add(n)
        if (!row.grade) return `Pitch ${n}: pick a grade, or remove the pitch.`
        if (row.length_m.trim() !== '') {
            const len = Number(row.length_m)
            if (!(len > 0)) return `Pitch ${n}: the length has to be more than 0 m.`
        }
    }
    return null
}

function rowsToPitches(rows: PitchFormRow[]): Pitch[] {
    return rows
        .map(r => ({
            pitch_number: Number(r.pitch_number),
            grade: r.grade,
            length_m: r.length_m.trim() === '' ? null : Number(r.length_m),
            notes: r.notes.trim() === '' ? null : r.notes.trim(),
        }))
        .sort((a, b) => a.pitch_number - b.pitch_number)
}

/**
 * The multi-pitch fields of a create body. A rock that is not a wall, or a
 * blank count, sends the "single pitch" shape, never stale pitch detail typed
 * before the person picked a different rock. Call pitchFormError first.
 */
export function pitchFormToCreate(f: PitchFormState, onWall: boolean):
    Pick<CreateProblemRequest, 'pitch_count' | 'commitment_grade' | 'pitches'> {
    if (!onWall || f.pitch_count.trim() === '') return { pitch_count: null, commitment_grade: '', pitches: [] }
    return { pitch_count: Number(f.pitch_count), commitment_grade: f.commitment_grade, pitches: rowsToPitches(f.pitches) }
}

/**
 * The multi-pitch fields of an update body. Off a wall it sends nothing at
 * all, so whatever is stored stays exactly as it is (hidden, not deleted). On
 * a wall with a blank count it sends only pitch_count: null, which makes the
 * route single pitch while keeping the grade and rows stored underneath in
 * case the count is set again. Call pitchFormError first.
 */
export function pitchFormToUpdate(f: PitchFormState, onWall: boolean):
    Pick<UpdateProblemRequest, 'pitch_count' | 'commitment_grade' | 'pitches'> {
    if (!onWall) return {}
    if (f.pitch_count.trim() === '') return { pitch_count: null }
    return { pitch_count: Number(f.pitch_count), commitment_grade: f.commitment_grade, pitches: rowsToPitches(f.pitches) }
}

/** "4 of 10 pitches documented", surfacing the gap rather than hiding it
 * (decision 23): the claim about the route and what is written down are not
 * required to agree. Null when there is no gap to point at. */
export function documentedGap(pitchCount: number | null, documented: number): string | null {
    if (pitchCount == null || documented === 0 || documented >= pitchCount) return null
    return `${documented} of ${pitchCount} pitches documented`
}
