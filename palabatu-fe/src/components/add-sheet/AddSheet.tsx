import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, ChevronRight, MapPin } from 'lucide-react'
import { api } from '../../lib/api.js'
import { getAllCrags, fetchBouldersForCrag, invalidateCragCache } from '../../lib/cragCache.js'
import type { CragListItem, CreateCragRequest, Crag } from '../../types/crag.js'
import type { BoulderListItem, CreateBoulderRequest, Boulder } from '../../types/boulder.js'
import type { CreateProblemRequest, ProblemSummary } from '../../types/problem.js'
import type { TopoUploadResponse } from '../../types/problem.js'
import type { Shape } from '../../types/annotation.js'
import type { ErrorResponse } from '../../types/apitypes.js'
import Toast, { type ToastProps } from '../Toast.js'
import TopoAnnotationEditor from '../topo-annotations/TopoAnnotationEditor.js'
import LocationOverlay from './LocationOverlay.js'
import DraftsOverlay from './DraftsOverlay.js'
import ProblemFields from './ProblemFields.js'
import SpotFields from './SpotFields.js'
import RockFields from './RockFields.js'
import type { NearbyRock } from '../RockPointMap.js'
import { createDraft, updateDraft, getDraft, getAllDrafts, deleteDraft, type DraftSummary } from './drafts.js'
import {
    NEAR_M, haversineKm, formatDistanceM, blankSpot, blankRock, blankProblem,
    type AddIntent, type Geo, type NewSpotDraft, type NewRockDraft, type NewProblemDraft,
} from './types.js'

type AddSheetProps = {
    onClose: () => void
    /** Fired after any successful save -- callers reload whatever list they
     * show (Map.tsx's crag pins, a detail page's rock/problem list). */
    onAdded?: () => void
    initialIntent?: AddIntent
    initialCragId?: string
    initialBoulderId?: string
}

async function uploadPhoto(file: File): Promise<string | null> {
    const formData = new FormData()
    formData.append('image', file)
    const res = await api.upload<Partial<TopoUploadResponse & ErrorResponse>>('/api/upload/topo', formData)
    return res.url ?? null
}

// Reuses an already-uploaded URL (drafting's eager upload, handoff-drafts.md
// decision 10, or a draft resumed from another device with no local File at
// all) instead of re-uploading the same photo a second time at submit.
async function resolvePhotoUrl(file: File | null, cachedUrl: string | null): Promise<string | null> {
    if (cachedUrl) return cachedUrl
    if (!file) return null
    return uploadPhoto(file)
}

// One scrolling sheet, three intents (handoff.md decisions 11-20; see
// prototypes/add-flow-v2.html for the worked interaction spec). Replaces
// the deleted components/add-flow/ three-step wizard wholesale.
export default function AddSheet({ onClose, onAdded, initialIntent, initialCragId, initialBoulderId }: AddSheetProps) {
    const navigate = useNavigate()
    const [toast, setToast] = useState<ToastProps | null>(null)
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) })

    const [intent, setIntent] = useState<AddIntent>(initialIntent ?? 'problem')
    const bodyRef = useRef<HTMLDivElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    const [crags, setCrags] = useState<CragListItem[]>([])
    const [myLoc, setMyLoc] = useState<Geo | null>(null)
    // Two separate one-shots (handoff-add-sheet.md A2): the initialCragId/
    // initialBoulderId branches are genuinely one-shot the moment crags load,
    // but the nearest-spot default has to wait for myLoc, which resolves
    // later (after a permission prompt) -- sharing one guard between them
    // meant the guard burned itself on the first (empty) run and the
    // nearest-spot branch never got a second chance.
    const didResolveContext = useRef(false)
    const didResolveNearest = useRef(false)

    // Resolved context, shared across the problem/rock intents.
    const [cragId, setCragId] = useState<string | null>(initialCragId ?? null)
    const [boulderId, setBoulderId] = useState<string | null>(initialBoulderId ?? null)
    const [resolvedBoulder, setResolvedBoulder] = useState<BoulderListItem | null>(null)
    const [isNewSpot, setIsNewSpot] = useState(false)
    const [newSpotDraft, setNewSpotDraft] = useState<NewSpotDraft>(blankSpot)
    const [overlayOpen, setOverlayOpen] = useState(false)
    // C11: "It's a new rock" and "Not sure which one" used to be
    // byte-identical. This is the difference, recorded at the moment the
    // person says it rather than inferred later from an unnamed, photoless,
    // single-problem rock (handoff.md open item 9). null means the question
    // never came up -- an implicit rock created because the spot has none.
    const [filedUncertain, setFiledUncertain] = useState<boolean | null>(null)

    const [newRockDraft, setNewRockDraft] = useState<NewRockDraft>(blankRock)
    // The resolved spot's already-pinned rocks, for the rock tab's pin map:
    // seeing them is what stops a contributor pinning a second entry for a
    // rock that's already on the map (the duplicate state boulders' merge
    // flow exists to clean up afterwards).
    const [siblingRocks, setSiblingRocks] = useState<BoulderListItem[]>([])

    const [problemDraft, setProblemDraft] = useState<NewProblemDraft>(blankProblem)
    const [moreOpen, setMoreOpen] = useState(false)
    const [annotationShapes, setAnnotationShapes] = useState<Shape[]>([])
    const [lineDrawn, setLineDrawn] = useState(false)
    const [annotatingUrl, setAnnotatingUrl] = useState<string | null>(null)
    const [annotatingProblemId, setAnnotatingProblemId] = useState<string | undefined>(undefined)

    const [submitting, setSubmitting] = useState(false)
    const [savedCount, setSavedCount] = useState(0)
    const [problemBanner, setProblemBanner] = useState<{
        name: string; problemId: string; spotName: string; rockName: string; photoUrl: string | null; lineDrawn: boolean
    } | null>(null)
    const [rockBanner, setRockBanner] = useState<{ name: string } | null>(null)
    const [spotBanner, setSpotBanner] = useState<{ id: string; name: string } | null>(null)

    // Drafts (handoff-drafts.md M2, backend-synced via internal/drafts).
    // draftIdRef/draftCreatedAtRef track the one draft this open-to-close
    // session is writing to -- lazily assigned on the first real keystroke,
    // not on open (decision 3). A ref, not state: saveDraftNow is redefined
    // every render and a debounce timer can fire many renders after it was
    // scheduled, so reading draftId out of that render's own closure risks
    // seeing it still null after a *later* render's save already created
    // the row -- exactly the race that produced a duplicate draft during
    // testing (ensurePhotosUploaded's own setState mid-save triggers an
    // extra render before the create's response lands, and *that* render's
    // debounce timer captured null too). A ref sidesteps this: every
    // saveDraftNow call, whichever render's closure it runs in, reads the
    // one current value. `drafts` is the list overlay's contents (summaries
    // only -- see drafts.ts), also driving the "N drafts saved" affordance.
    const draftIdRef = useRef<string | null>(null)
    const draftCreatedAtRef = useRef<number | null>(null)
    const draftTimerRef = useRef<number | null>(null)
    const [drafts, setDrafts] = useState<DraftSummary[]>([])
    const [draftsOverlayOpen, setDraftsOverlayOpen] = useState(false)
    // Set only while handleClose is showing the "Saved as a draft" toast in
    // place of the sheet itself (decision 4) -- see the early return below.
    const [closingToast, setClosingToast] = useState<{ draftId: string } | null>(null)

    useEffect(() => { getAllCrags().then(setCrags) }, [])
    useEffect(() => { void refreshDrafts() }, [])
    async function refreshDrafts() {
        try { setDrafts(await getAllDrafts()) } catch { /* network unavailable -- drafts feature fails soft */ }
    }
    useEffect(() => {
        if (!navigator.geolocation) return
        navigator.geolocation.getCurrentPosition(
            pos => setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {},
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
        )
    }, [])

    // Resolve whatever the entry point pre-answered, or default to the
    // nearest spot (handoff.md decision 19: "the breadcrumb arrives
    // answered"). Runs once, after crags have loaded.
    useEffect(() => {
        if (crags.length === 0) return
        if (initialBoulderId || initialCragId) {
            if (didResolveContext.current) return
            didResolveContext.current = true
            void (async () => {
                if (initialBoulderId) {
                    const b = await api.get<BoulderListItem | ErrorResponse>(`/api/boulders/${initialBoulderId}`)
                    if (!('error' in b)) { setResolvedBoulder(b); setBoulderId(b.id); setCragId(b.crag_id) }
                    return
                }
                if (initialCragId && intent === 'problem') {
                    const list = await fetchBouldersForCrag(initialCragId)
                    if (list.length === 1 && list[0]) { setBoulderId(list[0].id); setResolvedBoulder(list[0]) }
                }
            })()
            return
        }
        // No pre-answered context -- wait for myLoc (arrives after a
        // permission prompt, later than crags) before defaulting to nearest.
        if (didResolveNearest.current || !myLoc) return
        didResolveNearest.current = true
        void (async () => {
            const nearest = [...crags].sort((a, b) => haversineKm(myLoc, { lat: a.lat, lng: a.lng }) - haversineKm(myLoc, { lat: b.lat, lng: b.lng }))[0]
            if (nearest) {
                setCragId(nearest.id)
                const list = await fetchBouldersForCrag(nearest.id)
                if (list.length === 1 && list[0]) { setBoulderId(list[0].id); setResolvedBoulder(list[0]) }
            }
        })()
        // Re-runs when myLoc resolves after crags -- guarded by
        // didResolveNearest so it only ever does real work once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [crags, myLoc])

    // Only the rock tab draws these, so only it pays for the fetch. Uncached
    // (fetchBouldersForCrag, not getBouldersForCrag) for the same reason the
    // picker is: a rock added moments ago must show up as a sibling.
    useEffect(() => {
        if (intent !== 'rock' || !cragId) { setSiblingRocks([]); return }
        let cancelled = false
        void fetchBouldersForCrag(cragId).then(list => { if (!cancelled) setSiblingRocks(list) })
        return () => { cancelled = true }
    }, [intent, cragId])

    const resolvedCrag = cragId ? crags.find(c => c.id === cragId) ?? null : null
    const cragDistKm = resolvedCrag && myLoc ? haversineKm(myLoc, { lat: resolvedCrag.lat, lng: resolvedCrag.lng }) : null
    const isFar = cragDistKm != null && cragDistKm * 1000 > NEAR_M
    const boulderType = resolvedBoulder?.type ?? 'boulder'
    const noun = boulderType === 'wall' ? 'route' : 'problem'

    // The frame of reference the rock tab's pin map opens in -- the chosen
    // spot, or the one being created alongside it in the same session. Null
    // until one of those exists, since "where within the spot?" is
    // unanswerable before there's a spot.
    const rockPinCrag: { center: Geo; name: string } | null = resolvedCrag
        ? { center: { lat: resolvedCrag.lat, lng: resolvedCrag.lng }, name: resolvedCrag.name }
        : isNewSpot && newSpotDraft.lat != null && newSpotDraft.lng != null
            ? { center: { lat: newSpotDraft.lat, lng: newSpotDraft.lng }, name: newSpotDraft.name.trim() || 'the new spot' }
            : null

    const nearbyRocks: NearbyRock[] = siblingRocks
        .filter((b): b is BoulderListItem & { lat: number; lng: number } => b.lat != null && b.lng != null)
        .map(b => ({ id: b.id, label: b.name ?? b.sample_problem_name ?? 'Unnamed rock', lat: b.lat, lng: b.lng }))

    async function refreshCrags() {
        invalidateCragCache()
        const fresh = await getAllCrags()
        setCrags(fresh)
        return fresh
    }

    // -------------------------------------------------------------- overlay callbacks
    function clearRockSelection() {
        setBoulderId(null)
        setResolvedBoulder(null)
        setAnnotationShapes([])
        setLineDrawn(false)
    }

    const overlay = overlayOpen && intent !== 'spot' && (
        <LocationOverlay
            intent={intent === 'rock' ? 'rock' : 'problem'}
            allCrags={crags}
            myLoc={myLoc}
            initialExpandedCragId={cragId}
            newSpotDraft={newSpotDraft}
            onNewSpotDraftChange={setNewSpotDraft}
            onClose={() => setOverlayOpen(false)}
            onPickSpotOnly={crag => { setCragId(crag.id); setIsNewSpot(false); setOverlayOpen(false) }}
            onPickSpotAndRock={(crag, boulder) => {
                setCragId(crag.id); setIsNewSpot(false); setBoulderId(boulder.id); setResolvedBoulder(boulder)
                setAnnotationShapes([]); setLineDrawn(false); setOverlayOpen(false)
            }}
            onPickSpotNoRocks={crag => { setCragId(crag.id); setIsNewSpot(false); clearRockSelection(); setFiledUncertain(null); setOverlayOpen(false) }}
            onPickNewRock={crag => { setCragId(crag.id); setIsNewSpot(false); clearRockSelection(); setFiledUncertain(false); setOverlayOpen(false) }}
            onPickNotSure={crag => { setCragId(crag.id); setIsNewSpot(false); clearRockSelection(); setFiledUncertain(true); setOverlayOpen(false) }}
            onConfirmNewSpot={() => { setIsNewSpot(true); setCragId(null); clearRockSelection(); setOverlayOpen(false) }}
        />
    )

    // ------------------------------------------------------------------ submit
    async function resolveCragId(): Promise<{ id: string; name: string } | null> {
        if (!isNewSpot) return cragId ? { id: cragId, name: resolvedCrag?.name ?? '' } : null
        if (!newSpotDraft.name.trim() || newSpotDraft.lat == null || newSpotDraft.lng == null) return null
        const uploadedUrl = await resolvePhotoUrl(newSpotDraft.photoFile, newSpotDraft.photoUrl)
        const imageUrls = uploadedUrl ? [uploadedUrl] : []
        if (newSpotDraft.photoFile && !uploadedUrl) showError('The spot photo did not upload -- saved without it')
        const body: CreateCragRequest = {
            name: newSpotDraft.name, lat: newSpotDraft.lat, lng: newSpotDraft.lng,
            directions: newSpotDraft.directions, access_notes: newSpotDraft.access_notes, image_urls: imageUrls,
        }
        const res = await api.post<Crag | ErrorResponse>('/api/crags', body)
        if ('error' in res) { showError(res.error); return null }
        await refreshCrags()
        // Commit immediately, not just on the caller's eventual success --
        // a later step in submitRock/submitProblem (boulder or problem POST)
        // failing must not leave isNewSpot true, or retrying re-POSTs a
        // second crag at the same pin (handoff-add-sheet.md A3). Committing
        // here also means a second "Add problem" after this one takes the
        // already-resolved branch instead of trying to recreate the spot
        // (A1).
        setCragId(res.id)
        setIsNewSpot(false)
        setNewSpotDraft(blankSpot)
        return { id: res.id, name: res.name }
    }

    async function submitSpot() {
        if (!newSpotDraft.name.trim() || newSpotDraft.lat == null) { showError('Give the place a name and a pin'); return }
        setSubmitting(true)
        try {
            const uploadedUrl = await resolvePhotoUrl(newSpotDraft.photoFile, newSpotDraft.photoUrl)
            const imageUrls = uploadedUrl ? [uploadedUrl] : []
            if (newSpotDraft.photoFile && !uploadedUrl) showError('The photo did not upload -- saved without it')
            const body: CreateCragRequest = {
                name: newSpotDraft.name, lat: newSpotDraft.lat, lng: newSpotDraft.lng!,
                directions: newSpotDraft.directions, access_notes: newSpotDraft.access_notes, image_urls: imageUrls,
            }
            const res = await api.post<Crag | ErrorResponse>('/api/crags', body)
            if ('error' in res) { showError(res.error); return }
            await refreshCrags()
            setSpotBanner({ id: res.id, name: res.name })
            setNewSpotDraft(blankSpot)
            setCragId(res.id); setIsNewSpot(false); clearRockSelection()
            onAdded?.()
            await clearActiveDraft()
        } finally { setSubmitting(false) }
    }

    async function submitRock() {
        const hasPhotoOrName = newRockDraft.imageFiles.length > 0 || newRockDraft.name.trim() !== ''
        if (!hasPhotoOrName) { showError('Add a photo or a name, so people can find it again'); return }
        setSubmitting(true)
        try {
            const resolved = await resolveCragId()
            if (!resolved) { showError('Please finish adding the new spot first'); return }
            const resolvedUrls = newRockDraft.imageFiles.length
                ? await Promise.all(newRockDraft.imageFiles.map((f, i) => resolvePhotoUrl(f, newRockDraft.imageUrls[i] ?? null)))
                : []
            const imageUrls = resolvedUrls.filter((u): u is string => !!u)
            if (newRockDraft.imageFiles.length && imageUrls.length < newRockDraft.imageFiles.length) {
                showError(imageUrls.length === 0 ? 'The photo did not upload -- saved without it' : 'One of the photos did not upload')
            }
            const body: CreateBoulderRequest = {
                crag_id: resolved.id, name: newRockDraft.name, type: newRockDraft.type,
                rock_type: newRockDraft.rock_type,
                // Both or neither -- the backend's validateLatLng no-ops when
                // either is nil, and half a coordinate is meaningless anyway.
                lat: newRockDraft.lng == null ? null : newRockDraft.lat,
                lng: newRockDraft.lat == null ? null : newRockDraft.lng,
                image_urls: imageUrls,
            }
            const res = await api.post<Boulder | ErrorResponse>('/api/boulders', body)
            if ('error' in res) { showError(res.error); return }
            await refreshCrags()
            setRockBanner({ name: res.name ?? (res.type === 'wall' ? 'The wall' : 'The rock') })
            setNewRockDraft(blankRock)
            // The rock just made becomes the resolved context -- the obvious
            // next act is the first line on it, not re-finding it in the
            // picker (handoff-add-sheet.md B5).
            const fresh = await api.get<BoulderListItem | ErrorResponse>(`/api/boulders/${res.id}`)
            if (!('error' in fresh)) { setResolvedBoulder(fresh); setBoulderId(fresh.id) }
            onAdded?.()
            await clearActiveDraft()
        } finally { setSubmitting(false) }
    }

    async function submitProblem() {
        if (!problemDraft.name.trim()) { showError('Give it a name first'); return }
        setSubmitting(true)
        try {
            const resolved = await resolveCragId()
            if (!resolved) { showError('Please finish adding the new spot first'); return }

            let resolvedBoulderId = boulderId
            let targetPhotoUrl: string | null = resolvedBoulder?.image_urls[0] ?? null
            const stagedFile = problemDraft.photoFile
            const stagedUrl = problemDraft.photoUrl
            // Reuses drafting's eager upload (handoff-drafts.md decision 10)
            // or a draft resumed from another device (no local File at all)
            // instead of re-uploading the same photo a second time.
            const hasStagedPhoto = !!stagedFile || !!stagedUrl

            if (!resolvedBoulderId) {
                // Implicit new rock, explicit "it's a new rock", and "not
                // sure which one" all create the same bare boulder -- but
                // they are no longer indistinguishable afterwards
                // (handoff-add-sheet.md C11, closed 2026-09-06 alongside
                // handoff.md open item 9). filedUncertain carries which of
                // the three it was: true said not sure, false said it was
                // new, null was never asked. The admin tidy-up queue keys on
                // it rather than inferring uncertainty from an unnamed,
                // photoless, single-problem rock after the fact.
                const uploadedUrl = await resolvePhotoUrl(stagedFile, stagedUrl)
                const imageUrls = uploadedUrl ? [uploadedUrl] : []
                if (uploadedUrl) {
                    targetPhotoUrl = uploadedUrl
                } else if (stagedFile) {
                    showError('The photo did not upload -- the rock was saved without it, and your line was not saved')
                }
                const body: CreateBoulderRequest = { crag_id: resolved.id, name: '', type: 'boulder', rock_type: '', lat: null, lng: null, image_urls: imageUrls, filed_uncertain: filedUncertain }
                const res = await api.post<Boulder | ErrorResponse>('/api/boulders', body)
                if ('error' in res) { showError(res.error); return }
                resolvedBoulderId = res.id
            } else if (hasStagedPhoto && (resolvedBoulder?.image_urls.length ?? 0) === 0) {
                // The chosen rock had no topo yet -- this becomes it.
                const url = await resolvePhotoUrl(stagedFile, stagedUrl)
                if (url) {
                    targetPhotoUrl = url
                    const attachRes = await api.post<Partial<ErrorResponse>>(`/api/boulders/${resolvedBoulderId}/images`, { image_urls: [url] })
                    if (attachRes.error) showError('The photo uploaded but did not attach to the rock')
                } else {
                    showError('The photo did not upload -- the problem was saved without it, and your line was not saved')
                }
            } else if (hasStagedPhoto) {
                // The chosen rock already has a topo -- a staged shot moves
                // with it as an extra angle rather than being silently
                // dropped (handoff-add-sheet.md B7). It uploads and attaches
                // the same way either way; what changes is only which URL
                // the line targets, per the founder's photoChoice (handoff.md
                // open item 16) -- 'own' points the line at this shot instead
                // of the rock's shared photo.
                const url = await resolvePhotoUrl(stagedFile, stagedUrl)
                if (url) {
                    const attachRes = await api.post<Partial<ErrorResponse>>(`/api/boulders/${resolvedBoulderId}/images`, { image_urls: [url] })
                    if (attachRes.error) showError('The extra photo did not attach to the rock')
                    if (problemDraft.photoChoice === 'own') targetPhotoUrl = url
                } else if (problemDraft.photoChoice === 'own') {
                    // The line was drawn against this photo specifically
                    // (its own normalized coordinates) -- with no upload,
                    // there is nothing honest to fall back to, so the shared
                    // photo is not drawn on in its place.
                    targetPhotoUrl = null
                    showError('Your photo did not upload -- the problem was saved without it, and your line was not saved')
                } else {
                    showError('The extra photo did not upload')
                }
            }

            const heightM = problemDraft.height_m.trim() ? Number(problemDraft.height_m) : null
            const createBody: CreateProblemRequest = {
                name: problemDraft.name, grade: problemDraft.grade, boulder_id: resolvedBoulderId,
                first_ascensionist: problemDraft.first_ascensionist, discovered_by: problemDraft.discovered_by,
                landing_hazards: problemDraft.landing_hazards, descent: problemDraft.descent,
                height_m: heightM, notes: problemDraft.notes, image_urls: [],
            }
            const res = await api.post<ProblemSummary | ErrorResponse>('/api/problems', createBody)
            if ('error' in res) { showError(res.error); return }

            let savedLine = false
            if (targetPhotoUrl && annotationShapes.length > 0) {
                const annotationRes = await api.put<Partial<ErrorResponse>>(`/api/problems/${res.id}/annotations`, { url: targetPhotoUrl, data: annotationShapes })
                if (annotationRes.error) {
                    showError('Your line did not save -- redraw it from the problem page')
                } else {
                    savedLine = true
                }
            }

            await refreshCrags()
            onAdded?.()
            await clearActiveDraft()

            setProblemBanner({
                name: res.name, problemId: res.id,
                spotName: resolvedCrag?.name ?? resolved.name,
                rockName: resolvedBoulder?.name ?? resolvedBoulder?.sample_problem_name ?? 'a new rock',
                photoUrl: targetPhotoUrl, lineDrawn: savedLine,
            })
            setSavedCount(c => c + 1)

            // Reset only the climb fields -- spot and rock stay filled in,
            // ready for the next line on the same rock (decision 20).
            setProblemDraft(blankProblem)
            setAnnotationShapes([])
            setLineDrawn(false)
            if (resolvedBoulderId) {
                const fresh = await api.get<BoulderListItem | ErrorResponse>(`/api/boulders/${resolvedBoulderId}`)
                if (!('error' in fresh)) { setResolvedBoulder(fresh); setBoulderId(fresh.id) }
            }
            bodyRef.current?.scrollTo({ top: 0 })
        } finally { setSubmitting(false) }
    }

    const handleSubmit = () => {
        if (intent === 'spot') return submitSpot()
        if (intent === 'rock') return submitRock()
        return submitProblem()
    }

    // -------------------------------------------------------------- modal basics
    // Typed content is never silently discarded (decision 18). Closing used
    // to block on a window.confirm (handoff-add-sheet.md C12); now that
    // every keystroke is autosaved (below), there is nothing left to
    // confirm away -- see handleClose (handoff-drafts.md decision 4).
    function hasUnsavedInput(): boolean {
        const spotDirty = newSpotDraft.name.trim() !== '' || newSpotDraft.lat != null
            || newSpotDraft.directions.trim() !== '' || newSpotDraft.access_notes.trim() !== ''
            || !!newSpotDraft.photoFile || !!newSpotDraft.photoUrl
        const rockDirty = newRockDraft.name.trim() !== '' || newRockDraft.rock_type.trim() !== ''
            || newRockDraft.imageFiles.length > 0 || newRockDraft.imageUrls.length > 0 || newRockDraft.lat != null
        const problemDirty = problemDraft.name.trim() !== '' || problemDraft.grade !== ''
            || problemDraft.first_ascensionist.trim() !== '' || problemDraft.discovered_by.trim() !== ''
            || problemDraft.landing_hazards.trim() !== '' || problemDraft.descent.trim() !== ''
            || problemDraft.height_m.trim() !== '' || problemDraft.notes.trim() !== ''
            || !!problemDraft.photoFile || !!problemDraft.photoUrl
        return spotDirty || rockDirty || problemDirty
    }

    // ------------------------------------------------------------- drafts (M2)
    // A draft snapshots the sheet's *entire* live state, not just the active
    // tab -- intent just records which tab was showing when it was saved
    // (handoff-drafts.md's data model mirrors AddSheet's own state shape
    // one-for-one, so there's no parallel model to keep in sync).
    function computeDraftLabel(): string {
        const spotLabel = resolvedCrag?.name || (isNewSpot ? newSpotDraft.name.trim() : '') || null
        if (intent === 'rock') {
            if (newRockDraft.name.trim()) return newRockDraft.name.trim()
            return spotLabel ? `New rock · ${spotLabel}` : 'New rock'
        }
        if (intent === 'spot') return newSpotDraft.name.trim() || 'New spot'
        if (problemDraft.name.trim()) return problemDraft.name.trim()
        const rockLabel = resolvedBoulder?.name || resolvedBoulder?.sample_problem_name || null
        if (rockLabel) return spotLabel ? `${rockLabel} · ${spotLabel}` : rockLabel
        return spotLabel ? `New problem · ${spotLabel}` : 'New problem'
    }

    // Uploads whatever staged File doesn't have a matching URL yet (a fresh
    // pick always clears its URL field -- see SpotFields/RockFields/
    // ProblemFields' onChange handlers) and returns the three draft objects
    // with those URLs filled in. Returned, not just set via setState: the
    // caller needs them synchronously in the same tick to build the
    // payload, and a setState update wouldn't be visible in this closure
    // until the next render (handoff-drafts.md decision 10 -- upload
    // eagerly, not deferred to final submit).
    async function ensurePhotosUploaded(): Promise<{ spot: NewSpotDraft; rock: NewRockDraft; problem: NewProblemDraft }> {
        let spot = newSpotDraft
        if (spot.photoFile && !spot.photoUrl) {
            const url = await uploadPhoto(spot.photoFile)
            if (url) { spot = { ...spot, photoUrl: url }; setNewSpotDraft(spot) }
        }

        let rock = newRockDraft
        if (rock.imageFiles.some((_, i) => !rock.imageUrls[i])) {
            const urls = await Promise.all(rock.imageFiles.map((f, i) => rock.imageUrls[i] ?? uploadPhoto(f)))
            rock = { ...rock, imageUrls: urls }
            setNewRockDraft(rock)
        }

        let problem = problemDraft
        if (problem.photoFile && !problem.photoUrl) {
            const url = await uploadPhoto(problem.photoFile)
            if (url) { problem = { ...problem, photoUrl: url }; setProblemDraft(problem) }
        }

        return { spot, rock, problem }
    }

    // Creates or updates the active draft and returns its id, or null if
    // there is nothing worth saving or the request failed. Idempotent --
    // safe to call from the debounce timer and from handleClose without
    // double-creating a row (draftIdRef, once set, always routes to update
    // -- see its declaration for why this has to be a ref, not state).
    async function saveDraftNow(): Promise<string | null> {
        if (!hasUnsavedInput()) return null
        const { spot, rock, problem } = await ensurePhotosUploaded()
        const label = computeDraftLabel()
        const fields = { cragId, boulderId, isNewSpot, newSpotDraft: spot, newRockDraft: rock, problemDraft: problem }

        if (draftIdRef.current) {
            const updated = await updateDraft(draftIdRef.current, { label, ...fields })
            if (!updated) return null // network/API failure -- fail soft, nothing to resume/undo
            void refreshDrafts()
            return draftIdRef.current
        }
        const created = await createDraft({ intent, label, ...fields })
        if (!created) return null
        draftIdRef.current = created.id
        draftCreatedAtRef.current = created.createdAt
        void refreshDrafts()
        return created.id
    }

    // Debounced ~800ms after the last edit (handoff-drafts.md decision 3).
    // Only starts once hasUnsavedInput() is true, so opening and closing
    // the sheet without typing anything never manufactures a junk draft.
    useEffect(() => {
        if (!hasUnsavedInput()) return
        if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current)
        draftTimerRef.current = window.setTimeout(() => { void saveDraftNow() }, 800)
        return () => { if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intent, cragId, boulderId, isNewSpot, newSpotDraft, newRockDraft, problemDraft])

    // A draft is deleted the moment it's submitted for real, and only then
    // or on the owner's own "Remove" tap (decision 5) -- never on a timer
    // (decision 9). keepPhotos is true here specifically: by this point the
    // caller (submitSpot/submitRock/submitProblem) has already reused this
    // draft's uploaded URLs as the real crag/boulder/problem's own photo --
    // destroying them now would take down a just-created entity's photo
    // seconds after attaching it (see internal/drafts.DeleteDraft's doc
    // comment for the full reasoning).
    async function clearActiveDraft() {
        if (!draftIdRef.current) return
        try { await deleteDraft(draftIdRef.current, { keepPhotos: true }) } catch { /* best-effort */ }
        draftIdRef.current = null
        draftCreatedAtRef.current = null
        void refreshDrafts()
    }

    // Loads a saved draft back into the sheet's live state. The overlay only
    // ever held a summary (drafts.ts's DraftSummary -- decision 2's "real
    // draft list" stays light), so resuming fetches the full payload first.
    // A resumed draft may carry photoUrl/imageUrls with no matching local
    // File at all (drafted on this device, or another one) -- photoPreview
    // falls back straight to that remote URL rather than trying to make a
    // blob URL that has nothing to be made from.
    async function loadDraft(id: string) {
        const d = await getDraft(id)
        if (!d) { showError('That draft could not be loaded'); return }
        setIntent(d.intent)
        setCragId(d.cragId)
        setBoulderId(d.boulderId)
        setIsNewSpot(d.isNewSpot)
        setResolvedBoulder(null)
        setNewSpotDraft(d.newSpotDraft)
        // lat/lng/accuracyM are normalized rather than spread through: drafts
        // saved before the rock pin existed have no such keys, and `undefined`
        // would reach the pin map as a missing prop instead of "no pin yet".
        setNewRockDraft({
            ...d.newRockDraft,
            lat: d.newRockDraft.lat ?? null,
            lng: d.newRockDraft.lng ?? null,
            accuracyM: d.newRockDraft.accuracyM ?? null,
        })
        setProblemDraft(d.problemDraft)
        draftIdRef.current = d.id
        draftCreatedAtRef.current = d.createdAt
        if (d.boulderId) {
            void api.get<BoulderListItem | ErrorResponse>(`/api/boulders/${d.boulderId}`).then(b => {
                if (!('error' in b)) setResolvedBoulder(b)
            })
        }
        setDraftsOverlayOpen(false)
    }

    // Flushes any pending autosave, then either hands off to the "Saved as
    // a draft" toast (decision 4) or closes outright if there was nothing
    // to save this session.
    async function handleClose() {
        if (draftTimerRef.current) { window.clearTimeout(draftTimerRef.current); draftTimerRef.current = null }
        const savedId = await saveDraftNow()
        if (savedId) { setClosingToast({ draftId: savedId }); return }
        onClose()
    }

    // Focus the dialog on open, Escape closes the drafts overlay, then the
    // location overlay, then the sheet, and Tab is trapped inside the panel
    // -- both overlays are DOM children of the same panel (see the portal
    // below), so one trap covers all of it (handoff-add-sheet.md C12).
    useEffect(() => { panelRef.current?.focus() }, [])
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (closingToast) return
            if (e.key === 'Escape') {
                if (overlayOpen) { setOverlayOpen(false); return }
                if (draftsOverlayOpen) { setDraftsOverlayOpen(false); return }
                void handleClose()
                return
            }
            if (e.key === 'Tab' && panelRef.current) {
                const focusable = panelRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
                if (focusable.length === 0) return
                const first = focusable[0] as HTMLElement
                const last = focusable[focusable.length - 1] as HTMLElement
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
            }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    })

    // The sheet itself is gone; only the non-blocking "Saved as a draft"
    // toast remains on screen until it auto-dismisses (or Undo is tapped),
    // at which point the real onClose fires (handoff-drafts.md decision 4).
    if (closingToast) {
        return createPortal((
            <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
                <Toast
                    message="Saved as a draft"
                    type="success"
                    duration={4000}
                    actionLabel="Undo"
                    onAction={() => { void deleteDraft(closingToast.draftId); onClose() }}
                    onClose={onClose}
                />
            </div>
        ), document.body)
    }

    // -------------------------------------------------------------------- gate
    let submitLabel: string
    let ok: boolean
    let hint: string
    if (intent === 'spot') {
        submitLabel = 'Add spot'
        ok = newSpotDraft.name.trim() !== '' && newSpotDraft.lat != null
        hint = ok ? 'Saves on its own. Rocks and problems whenever you like.' : 'Give the place a name and drop a pin'
    } else if (intent === 'rock') {
        // Reads the tab's own draft, not boulderType (which is the
        // previously-selected *existing* rock's type) -- otherwise picking
        // "Tebing" here leaves the button reading "Add rock"
        // (handoff-add-sheet.md B6).
        submitLabel = newRockDraft.type === 'wall' ? 'Add wall' : 'Add rock'
        ok = (newRockDraft.imageFiles.length > 0 || newRockDraft.name.trim() !== '') && (cragId != null || (isNewSpot && !!newSpotDraft.name.trim() && newSpotDraft.lat != null))
        hint = ok ? 'Saves on its own. A rock with no problems yet is fine.' : 'Add a photo or a name, so people can find it again'
    } else {
        submitLabel = `Add ${noun}`
        ok = problemDraft.name.trim() !== ''
        hint = ok ? 'Grade, photo and the rest are optional.' : 'Give it a name first'
    }

    // -------------------------------------------------------------------- breadcrumb
    function Breadcrumb() {
        if (isNewSpot) {
            return (
                <button type="button" onClick={() => setOverlayOpen(true)} className="flex items-center gap-2.5 w-full min-h-11 px-3 py-2 bg-surface border border-border rounded-[10px] cursor-pointer text-left hover:border-accent">
                    <MapPin size={18} className="shrink-0 text-text-muted" />
                    <span className="flex-1 min-w-0 text-sm text-text-secondary">
                        <b className="text-text font-medium">{newSpotDraft.name || 'New spot'}</b> <span className="text-text-dim">&middot;</span> a new spot
                        <span className="block text-[11.5px] text-text-muted mt-0.5">pin dropped here</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-text-muted" />
                </button>
            )
        }
        if (!resolvedCrag) {
            return (
                <button type="button" onClick={() => setOverlayOpen(true)} className="flex items-center gap-2.5 w-full min-h-11 px-3 py-2 bg-surface border border-border rounded-[10px] cursor-pointer text-left hover:border-accent">
                    <MapPin size={18} className="shrink-0 text-text-muted" />
                    <span className="flex-1 text-sm text-text-muted">Where is it? &mdash; tap to choose</span>
                    <ChevronRight size={16} className="shrink-0 text-text-muted" />
                </button>
            )
        }
        const sub = intent === 'rock'
            ? (cragDistKm != null ? `${formatDistanceM(cragDistKm)} away` : '')
            : resolvedBoulder ? (resolvedBoulder.name ?? resolvedBoulder.sample_problem_name ?? 'no name yet')
                : (resolvedCrag.boulder_count > 0 ? 'pick a rock' : 'first rock here')
        return (
            <button
                type="button"
                onClick={() => setOverlayOpen(true)}
                className={`flex items-center gap-2.5 w-full min-h-11 px-3 py-2 bg-surface border rounded-[10px] cursor-pointer text-left hover:border-accent ${isFar ? 'border-danger/45' : 'border-border'}`}
            >
                <MapPin size={18} className={`shrink-0 ${isFar ? 'text-danger' : 'text-text-muted'}`} />
                <span className="flex-1 min-w-0 text-sm text-text-secondary">
                    <b className="text-text font-medium">{resolvedCrag.name}</b>
                    {cragDistKm != null && <> <span className="text-text-dim">&middot;</span> {formatDistanceM(cragDistKm)} away</>}
                    <span className="block text-[11.5px] text-text-muted mt-0.5">{sub}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-text-muted" />
            </button>
        )
    }

    // ---------------------------------------------------------------------- body
    let body: React.ReactNode
    if (intent === 'spot') {
        body = (
            <>
                {spotBanner && (
                    <div className="border border-associate/35 bg-associate/[0.06] rounded-[10px] px-3.5 py-3 mb-4">
                        <p className="text-sm text-text"><b>{spotBanner.name}</b> is on the map.</p>
                        <p className="text-xs text-text-muted mt-1.5">No problems yet &mdash; the next one's ready below, whenever you like.</p>
                        <button
                            type="button"
                            onClick={() => { onClose(); navigate(`/crags/${spotBanner.id}/approaches/new`) }}
                            className="mt-2.5 text-[13px] font-medium text-accent bg-transparent border-0 p-0 cursor-pointer hover:underline"
                        >
                            Add the way in &rarr;
                        </button>
                    </div>
                )}
                <SpotFields draft={newSpotDraft} onChange={setNewSpotDraft} allCrags={crags} />
            </>
        )
    } else if (intent === 'rock') {
        body = (
            <>
                {rockBanner && (
                    <div className="border border-associate/35 bg-associate/[0.06] rounded-[10px] px-3.5 py-3 mb-4">
                        <p className="text-sm text-text"><b>{rockBanner.name}</b> is up.</p>
                        <button
                            type="button"
                            onClick={() => { setIntent('problem'); setRockBanner(null) }}
                            className="w-full min-h-11 mt-2.5 rounded-lg border border-accent bg-accent/10 text-accent font-medium text-sm cursor-pointer hover:bg-accent/[0.18]"
                        >
                            Add the first {noun} on it
                        </button>
                        <p className="text-xs text-text-muted mt-2">Or another rock &mdash; the form below's ready whenever you like.</p>
                    </div>
                )}
                <Breadcrumb />
                <div className="h-px bg-border my-4" />
                <RockFields
                    draft={newRockDraft}
                    onChange={setNewRockDraft}
                    cragCenter={rockPinCrag?.center ?? null}
                    cragName={rockPinCrag?.name ?? ''}
                    nearbyRocks={nearbyRocks}
                />
            </>
        )
    } else {
        body = (
            <>
                {problemBanner && (
                    <div className="border border-associate/35 bg-associate/[0.06] rounded-[10px] px-3.5 py-3 mb-4">
                        <p className="text-sm text-text">
                            <b>{problemBanner.name}</b> is up.
                        </p>
                        {problemBanner.photoUrl && !problemBanner.lineDrawn ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => { setAnnotatingUrl(problemBanner.photoUrl); setAnnotatingProblemId(problemBanner.problemId) }}
                                    className="w-full min-h-11 mt-2.5 rounded-lg border border-accent bg-accent/10 text-accent font-medium text-sm cursor-pointer hover:bg-accent/[0.18]"
                                >
                                    Draw the line on the photo
                                </button>
                                <p className="text-xs text-text-muted mt-2">Do it now &mdash; you're standing at the rock. It's the one thing you can't add from home.</p>
                            </>
                        ) : (
                            <p className="text-xs text-text-muted mt-1.5">
                                {savedCount > 1 ? `${problemBanner.spotName} · ${problemBanner.rockName} — ${savedCount} added this session.` : `Still on ${problemBanner.rockName}.`} The next one's ready below.
                            </p>
                        )}
                    </div>
                )}
                <Breadcrumb />
                {!isNewSpot && resolvedCrag && isFar && (
                    <p className="text-xs text-text-muted mt-2">
                        Nothing of yours is nearby &mdash; the closest is {cragDistKm != null ? formatDistanceM(cragDistKm) : ''} away. If you're standing somewhere new, tap above and add it.
                    </p>
                )}
                <div className="h-px bg-border my-4" />
                <ProblemFields
                    draft={problemDraft}
                    onChange={setProblemDraft}
                    boulderType={boulderType}
                    hasExistingTopo={!!resolvedBoulder && resolvedBoulder.image_urls.length > 0 && !isNewSpot}
                    existingTopoUrl={resolvedBoulder?.image_urls[0] ?? null}
                    lineDrawn={lineDrawn}
                    onOpenAnnotator={url => { setAnnotatingUrl(url); setAnnotatingProblemId(undefined) }}
                    onSwitchPhotoTarget={choice => {
                        setProblemDraft(d => ({ ...d, photoChoice: choice }))
                        setAnnotationShapes([])
                        setLineDrawn(false)
                    }}
                    noun={noun}
                    moreOpen={moreOpen}
                    setMoreOpen={setMoreOpen}
                />
            </>
        )
    }

    const title = intent === 'spot' ? 'Add a spot' : intent === 'rock' ? (newRockDraft.type === 'wall' ? 'Add a wall' : 'Add a rock') : `Add a ${noun}`

    // Portaled to document.body, same pattern as InfoTooltip.tsx -- the
    // Footer is also position:fixed at the page root and would otherwise
    // fight this sheet for paint order at the bottom of the viewport where
    // this bottom-sheet layout and the footer's fixed position collide.
    return createPortal((
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
            {toast && <Toast {...toast} />}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-sheet-title"
                tabIndex={-1}
                className="relative bg-panel border border-border rounded-t-[20px] sm:rounded-[20px] w-full sm:max-w-[440px] h-[92dvh] sm:h-auto sm:max-h-[calc(100dvh-48px)] flex flex-col overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6)] font-sans outline-none"
            >
                <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-4">
                    <h2 id="add-sheet-title" className="font-serif text-[21px] font-bold text-text">{title}</h2>
                    <button type="button" onClick={handleClose} aria-label="Close" className="shrink-0 w-11 h-11 -m-1.5 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-text-secondary cursor-pointer bg-transparent border-0">
                        <X size={20} className="shrink-0" />
                    </button>
                </div>

                <div role="tablist" className="shrink-0 flex gap-0 mx-5 mt-3 p-[3px] bg-surface border border-border rounded-[10px]">
                    {(['problem', 'spot', 'rock'] as AddIntent[]).map(i => (
                        <button
                            key={i}
                            id={`add-sheet-tab-${i}`}
                            type="button"
                            role="tab"
                            aria-selected={intent === i}
                            aria-controls="add-sheet-tabpanel"
                            onClick={() => { setIntent(i); setProblemBanner(null); setSpotBanner(null); setRockBanner(null) }}
                            className={`flex-1 min-h-[38px] rounded-lg text-[13px] font-medium cursor-pointer border-0 whitespace-nowrap px-1 ${intent === i ? 'bg-panel text-text shadow-sm' : 'bg-transparent text-text-muted'}`}
                        >
                            {i === 'problem' ? 'A problem' : i === 'spot' ? 'A spot' : 'A rock'}
                        </button>
                    ))}
                </div>

                {drafts.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setDraftsOverlayOpen(true)}
                        className="shrink-0 flex items-center justify-between gap-2 mx-5 mt-3 px-1 py-1 text-[13px] text-text-muted bg-transparent border-0 cursor-pointer hover:text-text-secondary"
                    >
                        <span>{drafts.length} draft{drafts.length === 1 ? '' : 's'} saved</span>
                        <ChevronRight size={14} className="shrink-0" />
                    </button>
                )}

                <div ref={bodyRef} role="tabpanel" id="add-sheet-tabpanel" aria-labelledby={`add-sheet-tab-${intent}`} className="flex-1 overflow-y-auto px-5 pt-3.5 pb-5">
                    {body}
                </div>

                <div className="shrink-0 px-5 py-3 border-t border-border">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!ok || submitting}
                        className="w-full min-h-12 rounded-[10px] border-0 text-on-accent font-medium text-[15.5px] cursor-pointer bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))] shadow-[0_2px_16px_rgba(200,122,48,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {submitting ? 'Saving...' : submitLabel}
                    </button>
                    <p className="text-xs text-text-muted text-center mt-2">{hint}</p>
                </div>

                {overlay}
                {draftsOverlayOpen && (
                    <DraftsOverlay
                        drafts={drafts}
                        onLoad={loadDraft}
                        onRemove={id => { void deleteDraft(id).then(refreshDrafts) }}
                        onClose={() => setDraftsOverlayOpen(false)}
                    />
                )}
            </div>

            {annotatingUrl && (
                <TopoAnnotationEditor
                    url={annotatingUrl}
                    {...(annotatingProblemId ? { problemId: annotatingProblemId } : {})}
                    initialShapes={annotatingProblemId ? [] : annotationShapes}
                    onCancel={() => setAnnotatingUrl(null)}
                    onSaved={shapes => {
                        if (annotatingProblemId) {
                            setProblemBanner(b => b ? { ...b, lineDrawn: true } : b)
                        } else {
                            setAnnotationShapes(shapes)
                            setLineDrawn(shapes.length > 0)
                        }
                        setAnnotatingUrl(null)
                    }}
                />
            )}
        </div>
    ), document.body)
}
