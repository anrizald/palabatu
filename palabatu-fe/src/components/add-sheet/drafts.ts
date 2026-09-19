// Add-sheet draft persistence -- handoff-drafts.md Milestone 2 (backend
// sync, internal/drafts). Milestone 1 (2026-08-17) was IndexedDB-only; this
// replaces that storage with the API while keeping the same shape AddSheet.tsx
// works with (AddSheetDraft), so the autosave/overlay UI barely changes.
//
// Built speculatively, ahead of M1 proving itself -- the doc's own gate
// ("depends on whether M1 shows drafts actually getting used... don't build
// M2 speculatively") is real, but currently unfalsifiable: M1 is pure
// client-side IndexedDB with no signal anywhere about resume-vs-abandon
// rates across users. Built anyway, deliberately, rather than waiting on
// evidence nothing in this app can produce.
import { api } from '../../lib/api.js'
import type { DraftListItem, DraftRecord } from '../../types/draft.js'
import type { ErrorResponse } from '../../types/apitypes.js'
import {
    blankSpot, blankRock, blankProblem,
    type AddIntent, type NewSpotDraft, type NewRockDraft, type NewProblemDraft,
} from './types.js'

export type AddSheetDraft = {
    id: string
    intent: AddIntent
    /** Derived per handoff-drafts.md decision 6, recomputed on every autosave. */
    label: string
    createdAt: number
    updatedAt: number
    cragId: string | null
    boulderId: string | null
    isNewSpot: boolean
    newSpotDraft: NewSpotDraft
    newRockDraft: NewRockDraft
    problemDraft: NewProblemDraft
}

// The drafts-overlay row shape -- GET /api/drafts never sends a full
// payload (decision 2's "real draft list" for potentially many rows), so
// there's no File/preview to show, only whatever URL the backend already
// resolved as this draft's thumbnail.
export type DraftSummary = {
    id: string
    intent: AddIntent
    label: string
    thumbnailUrl: string | null
    updatedAt: number
}

// Every Cloudinary URL a draft's fields currently reference, sent alongside
// payload on every create/update so the backend can diff and sweep
// provisional uploads a later edit orphaned (decision 10) without parsing
// payload's opaque JSON to find them.
export function collectPhotoUrls(spot: NewSpotDraft, rock: NewRockDraft, problem: NewProblemDraft): string[] {
    const urls: string[] = []
    if (spot.photoUrl) urls.push(spot.photoUrl)
    for (const url of rock.imageUrls) if (url) urls.push(url)
    if (problem.photoUrl) urls.push(problem.photoUrl)
    return urls
}

// Strips the File/blob-preview fields no JSON payload can carry, keeping
// every plain value plus whatever's already been eagerly uploaded
// (NewXDraft.photoUrl / imageUrls -- see types.ts).
function buildPayload(d: Pick<AddSheetDraft, 'cragId' | 'boulderId' | 'isNewSpot' | 'newSpotDraft' | 'newRockDraft' | 'problemDraft'>) {
    const { photoFile: _spotFile, photoPreview: _spotPreview, ...newSpotDraft } = d.newSpotDraft
    const { imageFiles: _rockFiles, imagePreviews: _rockPreviews, ...newRockDraft } = d.newRockDraft
    const { photoFile: _problemFile, photoPreview: _problemPreview, ...problemDraft } = d.problemDraft
    return {
        cragId: d.cragId, boulderId: d.boulderId, isNewSpot: d.isNewSpot,
        newSpotDraft, newRockDraft, problemDraft,
    }
}

// Reverses buildPayload: reconstructs full NewXDraft shapes from a resumed
// payload, which never carries a File (JSON can't). photoPreview falls back
// to the already-uploaded URL directly -- there is no local blob to make
// one from, and the remote URL renders exactly the same in an <img>.
function hydratePayload(payload: Record<string, unknown>): Pick<AddSheetDraft, 'cragId' | 'boulderId' | 'isNewSpot' | 'newSpotDraft' | 'newRockDraft' | 'problemDraft'> {
    const spot = { ...blankSpot, ...(payload.newSpotDraft as Partial<NewSpotDraft> | undefined) }
    const rock = { ...blankRock, ...(payload.newRockDraft as Partial<NewRockDraft> | undefined) }
    const problem = { ...blankProblem, ...(payload.problemDraft as Partial<NewProblemDraft> | undefined) }
    return {
        cragId: (payload.cragId as string | null) ?? null,
        boulderId: (payload.boulderId as string | null) ?? null,
        isNewSpot: !!payload.isNewSpot,
        newSpotDraft: { ...spot, photoFile: null, photoPreview: spot.photoUrl },
        newRockDraft: {
            ...rock, imageFiles: [],
            imagePreviews: rock.imageUrls.map(u => u ?? '').filter(Boolean),
        },
        problemDraft: { ...problem, photoFile: null, photoPreview: problem.photoUrl },
    }
}

function fromRecord(r: DraftRecord): AddSheetDraft {
    return {
        id: r.id, intent: r.intent, label: r.label,
        createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at),
        ...hydratePayload(r.payload as Record<string, unknown>),
    }
}

type WriteFields = Pick<AddSheetDraft, 'intent' | 'cragId' | 'boulderId' | 'isNewSpot' | 'newSpotDraft' | 'newRockDraft' | 'problemDraft'> & { label: string }

export async function createDraft(d: WriteFields): Promise<AddSheetDraft | null> {
    const photoUrls = collectPhotoUrls(d.newSpotDraft, d.newRockDraft, d.problemDraft)
    const res = await api.post<DraftRecord | ErrorResponse>('/api/drafts', {
        intent: d.intent, label: d.label, payload: buildPayload(d), photo_urls: photoUrls,
    })
    if ('error' in res) return null
    return fromRecord(res)
}

export async function updateDraft(id: string, d: Omit<WriteFields, 'intent'>): Promise<AddSheetDraft | null> {
    const photoUrls = collectPhotoUrls(d.newSpotDraft, d.newRockDraft, d.problemDraft)
    const res = await api.put<DraftRecord | ErrorResponse>(`/api/drafts/${id}`, {
        label: d.label, payload: buildPayload(d), photo_urls: photoUrls,
    })
    if ('error' in res) return null
    return fromRecord(res)
}

export async function getDraft(id: string): Promise<AddSheetDraft | null> {
    const res = await api.get<DraftRecord | ErrorResponse>(`/api/drafts/${id}`)
    if ('error' in res) return null
    return fromRecord(res)
}

/** Newest-updated first -- the backend already orders this way. */
export async function getAllDrafts(): Promise<DraftSummary[]> {
    const res = await api.get<DraftListItem[] | ErrorResponse>('/api/drafts')
    if ('error' in res) return []
    return res.map(d => ({
        id: d.id, intent: d.intent, label: d.label,
        thumbnailUrl: d.thumbnail_url, updatedAt: Date.parse(d.updated_at),
    }))
}

/**
 * keepPhotos must be true for the post-submit cleanup call (submitSpot/
 * submitRock/submitProblem's clearActiveDraft) -- those URLs are, by then,
 * the real problem/boulder/crag's own photo, not an orphan. False is
 * genuine abandonment (the overlay's "Remove", or the "Undo" toast action),
 * where the photos really are only reachable through this draft.
 */
export async function deleteDraft(id: string, opts?: { keepPhotos?: boolean }): Promise<void> {
    const suffix = opts?.keepPhotos ? '?keep_photos=true' : ''
    await api.delete(`/api/drafts/${id}${suffix}`)
}

export function formatDraftAge(timestamp: number): string {
    const minutes = Math.floor((Date.now() - timestamp) / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}
