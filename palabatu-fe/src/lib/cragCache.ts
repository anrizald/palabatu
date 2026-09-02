import { api } from './api.js'
import type { CragListItem } from '../types/crag.js'
import type { BoulderListItem } from '../types/boulder.js'
import type { ProblemListItem, EnrichedProblem } from '../types/problem.js'
import type { ApproachListItem } from '../types/approach.js'
import type { ErrorResponse } from '../types/apitypes.js'

// Joins problem cards back to their crag's coordinates and their boulder's
// first photo without a backend change: GET /api/crags is small enough to
// fetch once (module-level cache, not React state -- reused across pages
// the same way api.ts itself is a plain module), and GET /api/crags/:id/boulders
// is the same call CragDetailPage needs anyway. Used by Directory.tsx,
// ProblemList.tsx, and Landing.tsx for "near you"/"locate on map" distance
// (a problem's crag always has coordinates -- handoff.md decision 4) and
// card thumbnails (a problem's boulder's first photo, if any).

let cragsPromise: Promise<CragListItem[]> | null = null
const boulderListCache = new Map<string, Promise<BoulderListItem[]>>()
const approachListCache = new Map<string, Promise<ApproachListItem[]>>()

export function getAllCrags(): Promise<CragListItem[]> {
    if (!cragsPromise) {
        cragsPromise = api.get<CragListItem[] | ErrorResponse>('/api/crags').then(data => {
            if ('error' in data) {
                cragsPromise = null // don't cache a failure
                return []
            }
            return data
        })
    }
    return cragsPromise
}

// Uncached fetch -- the add wizard's "which rock?" step needs this to
// reflect a boulder just created, so it calls this directly instead of
// going through getBouldersForCrag's cache below.
export async function fetchBouldersForCrag(cragId: string): Promise<BoulderListItem[]> {
    const data = await api.get<BoulderListItem[] | ErrorResponse>(`/api/crags/${cragId}/boulders`)
    return 'error' in data ? [] : data
}

export function getBouldersForCrag(cragId: string): Promise<BoulderListItem[]> {
    let cached = boulderListCache.get(cragId)
    if (!cached) {
        cached = fetchBouldersForCrag(cragId)
        boulderListCache.set(cragId, cached)
    }
    return cached
}

// Cached per crag, mirroring getBouldersForCrag -- the map's close-zoom
// layer (handoff.md open item 13) fetches a visible crag's approaches
// lazily and repeatedly as the user pans, so this avoids refetching on
// every render.
export function getApproachesForCrag(cragId: string): Promise<ApproachListItem[]> {
    let cached = approachListCache.get(cragId)
    if (!cached) {
        cached = api.get<ApproachListItem[] | ErrorResponse>(`/api/crags/${cragId}/approaches`).then(data => 'error' in data ? [] : data)
        approachListCache.set(cragId, cached)
    }
    return cached
}

// Called after any crag/boulder/approach create or edit so the next read
// reflects it, rather than serving stale cached data for the rest of the
// session.
export function invalidateCragCache() {
    cragsPromise = null
    boulderListCache.clear()
    approachListCache.clear()
}

// Batch enrichment for card grids/rows showing many problems at once
// (Directory.tsx, ProblemList.tsx, Landing.tsx). Used to also resolve each
// problem's thumbnail via a per-*distinct*-crag getBouldersForCrag() fan-out
// (finding 11's "1 + N requests"); now that handoff-directory.md's tier 1
// puts the boulder's photo directly on the wire as ProblemListItem.topo_url,
// that fan-out is gone -- one getAllCrags() call is the whole job, so a cold
// `/directory/all` is 2 requests total, not 1 + N.
//
// mapLat/mapLng now come from the crag only, not "boulder's own pin, falling
// back to the crag's" as before -- a boulder's own coordinates
// (handoff.md's 2026-08-30 rock-pin work) aren't part of tier 1, and fetching
// them here would bring the boulder fan-out straight back. This is a
// deliberate precision trade for a card's "locate on map" button: it now
// centers the map on the crag rather than the specific rock. Accepted
// because that button was always an approximate "jump to roughly here", not
// a precision instrument -- the map's own close-zoom layer is what shows
// boulder-level pins once you're actually at the crag (handoff.md's
// three-layer zoom design). Revisit only if that turns out to matter more
// than it looks like it should.
export async function enrichProblems(problems: ProblemListItem[]): Promise<EnrichedProblem[]> {
    const crags = await getAllCrags()
    const cragById = new Map(crags.map(c => [c.id, c]))

    return problems.map(p => {
        const crag = cragById.get(p.crag_id)
        return {
            ...p,
            thumbnailUrl: p.topo_url,
            mapLat: crag?.lat ?? null,
            mapLng: crag?.lng ?? null,
        }
    })
}
