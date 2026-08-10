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
import ProblemFields from './ProblemFields.js'
import SpotFields from './SpotFields.js'
import RockFields from './RockFields.js'
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

async function uploadPhotos(files: File[]): Promise<string[]> {
    const urls = await Promise.all(files.map(uploadPhoto))
    return urls.filter((u): u is string => !!u)
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

    const [crags, setCrags] = useState<CragListItem[]>([])
    const [myLoc, setMyLoc] = useState<Geo | null>(null)
    const didInit = useRef(false)

    // Resolved context, shared across the problem/rock intents.
    const [cragId, setCragId] = useState<string | null>(initialCragId ?? null)
    const [boulderId, setBoulderId] = useState<string | null>(initialBoulderId ?? null)
    const [resolvedBoulder, setResolvedBoulder] = useState<BoulderListItem | null>(null)
    const [isNewSpot, setIsNewSpot] = useState(false)
    const [newSpotDraft, setNewSpotDraft] = useState<NewSpotDraft>(blankSpot)
    const [overlayOpen, setOverlayOpen] = useState(false)

    const [newRockDraft, setNewRockDraft] = useState<NewRockDraft>(blankRock)

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

    useEffect(() => { getAllCrags().then(setCrags) }, [])
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
        if (crags.length === 0 || didInit.current) return
        didInit.current = true
        void (async () => {
            if (initialBoulderId) {
                const b = await api.get<BoulderListItem | ErrorResponse>(`/api/boulders/${initialBoulderId}`)
                if (!('error' in b)) { setResolvedBoulder(b); setBoulderId(b.id); setCragId(b.crag_id) }
                return
            }
            if (initialCragId) {
                if (intent === 'problem') {
                    const list = await fetchBouldersForCrag(initialCragId)
                    if (list.length === 1 && list[0]) { setBoulderId(list[0].id); setResolvedBoulder(list[0]) }
                }
                return
            }
            if (myLoc && crags.length > 0) {
                const nearest = [...crags].sort((a, b) => haversineKm(myLoc, { lat: a.lat, lng: a.lng }) - haversineKm(myLoc, { lat: b.lat, lng: b.lng }))[0]
                if (nearest) {
                    setCragId(nearest.id)
                    const list = await fetchBouldersForCrag(nearest.id)
                    if (list.length === 1 && list[0]) { setBoulderId(list[0].id); setResolvedBoulder(list[0]) }
                }
            }
        })()
        // Re-runs when myLoc resolves after crags -- guarded by didInit so
        // it only ever does real work once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [crags, myLoc])

    const resolvedCrag = cragId ? crags.find(c => c.id === cragId) ?? null : null
    const cragDistKm = resolvedCrag && myLoc ? haversineKm(myLoc, { lat: resolvedCrag.lat, lng: resolvedCrag.lng }) : null
    const isFar = cragDistKm != null && cragDistKm * 1000 > NEAR_M
    const boulderType = resolvedBoulder?.type ?? 'boulder'
    const noun = boulderType === 'wall' ? 'route' : 'problem'

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
            onPickSpotNoRocks={crag => { setCragId(crag.id); setIsNewSpot(false); clearRockSelection(); setOverlayOpen(false) }}
            onPickNewRock={crag => { setCragId(crag.id); setIsNewSpot(false); clearRockSelection(); setOverlayOpen(false) }}
            onPickNotSure={crag => { setCragId(crag.id); setIsNewSpot(false); clearRockSelection(); setOverlayOpen(false) }}
            onConfirmNewSpot={() => { setIsNewSpot(true); setCragId(null); clearRockSelection(); setOverlayOpen(false) }}
        />
    )

    // ------------------------------------------------------------------ submit
    async function resolveCragId(): Promise<string | null> {
        if (!isNewSpot) return cragId
        if (!newSpotDraft.name.trim() || newSpotDraft.lat == null || newSpotDraft.lng == null) return null
        const imageUrls = newSpotDraft.photoFile ? await uploadPhotos([newSpotDraft.photoFile]) : []
        const body: CreateCragRequest = {
            name: newSpotDraft.name, lat: newSpotDraft.lat, lng: newSpotDraft.lng,
            directions: newSpotDraft.directions, access_notes: newSpotDraft.access_notes, image_urls: imageUrls,
        }
        const res = await api.post<Crag | ErrorResponse>('/api/crags', body)
        if ('error' in res) { showError(res.error); return null }
        await refreshCrags()
        return res.id
    }

    async function submitSpot() {
        if (!newSpotDraft.name.trim() || newSpotDraft.lat == null) { showError('Give the place a name and a pin'); return }
        setSubmitting(true)
        try {
            const imageUrls = newSpotDraft.photoFile ? await uploadPhotos([newSpotDraft.photoFile]) : []
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
        } finally { setSubmitting(false) }
    }

    async function submitRock() {
        const hasPhotoOrName = newRockDraft.imageFiles.length > 0 || newRockDraft.name.trim() !== ''
        if (!hasPhotoOrName) { showError('Add a photo or a name, so people can find it again'); return }
        setSubmitting(true)
        try {
            const resolvedCragId = await resolveCragId()
            if (!resolvedCragId) { showError('Please finish adding the new spot first'); return }
            const imageUrls = newRockDraft.imageFiles.length ? await uploadPhotos(newRockDraft.imageFiles) : []
            const body: CreateBoulderRequest = {
                crag_id: resolvedCragId, name: newRockDraft.name, type: newRockDraft.type,
                rock_type: newRockDraft.rock_type, lat: null, lng: null, image_urls: imageUrls,
            }
            const res = await api.post<Boulder | ErrorResponse>('/api/boulders', body)
            if ('error' in res) { showError(res.error); return }
            await refreshCrags()
            setRockBanner({ name: res.name ?? (res.type === 'wall' ? 'The wall' : 'The rock') })
            setNewRockDraft(blankRock)
            setCragId(resolvedCragId); setIsNewSpot(false)
            onAdded?.()
        } finally { setSubmitting(false) }
    }

    async function submitProblem() {
        if (!problemDraft.name.trim()) { showError('Give it a name first'); return }
        setSubmitting(true)
        try {
            const resolvedCragId = await resolveCragId()
            if (!resolvedCragId) { showError('Please finish adding the new spot first'); return }

            let resolvedBoulderId = boulderId
            let targetPhotoUrl: string | null = resolvedBoulder?.image_urls[0] ?? null
            const stagedFile = problemDraft.photoFile

            if (!resolvedBoulderId) {
                // Implicit new rock, explicit "it's a new rock", and "not
                // sure which one" all collapse to the same operation
                // (handoff.md's prototype: identical handlers, different
                // narrative only) -- a bare boulder, named/photographed only
                // if the user happened to stage a photo here.
                const imageUrls = stagedFile ? await uploadPhotos([stagedFile]) : []
                if (imageUrls[0]) targetPhotoUrl = imageUrls[0]
                const body: CreateBoulderRequest = { crag_id: resolvedCragId, name: '', type: 'boulder', rock_type: '', lat: null, lng: null, image_urls: imageUrls }
                const res = await api.post<Boulder | ErrorResponse>('/api/boulders', body)
                if ('error' in res) { showError(res.error); return }
                resolvedBoulderId = res.id
            } else if (stagedFile && (resolvedBoulder?.image_urls.length ?? 0) === 0) {
                // The chosen rock had no topo yet -- this becomes it.
                const url = await uploadPhoto(stagedFile)
                if (url) {
                    targetPhotoUrl = url
                    await api.post<unknown>(`/api/boulders/${resolvedBoulderId}/images`, { image_urls: [url] }).catch(() => {})
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
                await api.put<unknown>(`/api/problems/${res.id}/annotations`, { url: targetPhotoUrl, data: annotationShapes }).catch(() => {})
                savedLine = true
            }

            await refreshCrags()
            onAdded?.()

            setProblemBanner({
                name: res.name, problemId: res.id,
                spotName: resolvedCrag?.name ?? newSpotDraft.name,
                rockName: resolvedBoulder?.name ?? resolvedBoulder?.sample_problem_name ?? 'a new rock',
                photoUrl: targetPhotoUrl, lineDrawn: savedLine,
            })
            setSavedCount(c => c + 1)

            // Reset only the climb fields -- spot and rock stay filled in,
            // ready for the next line on the same rock (decision 20).
            setProblemDraft(blankProblem)
            setAnnotationShapes([])
            setLineDrawn(false)
            setIsNewSpot(false)
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

    // -------------------------------------------------------------------- gate
    let submitLabel: string
    let ok: boolean
    let hint: string
    if (intent === 'spot') {
        submitLabel = 'Add spot'
        ok = newSpotDraft.name.trim() !== '' && newSpotDraft.lat != null
        hint = ok ? 'Saves on its own. Rocks and problems whenever you like.' : 'Give the place a name and drop a pin'
    } else if (intent === 'rock') {
        submitLabel = boulderType === 'wall' ? 'Add wall' : 'Add rock'
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
                        <p className="text-sm text-text"><b>{rockBanner.name}</b> is up. The next one's ready below.</p>
                    </div>
                )}
                <Breadcrumb />
                <div className="h-px bg-border my-4" />
                <RockFields draft={newRockDraft} onChange={setNewRockDraft} />
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
                    noun={noun}
                    moreOpen={moreOpen}
                    setMoreOpen={setMoreOpen}
                />
            </>
        )
    }

    const title = intent === 'spot' ? 'Add a spot' : intent === 'rock' ? (boulderType === 'wall' ? 'Add a wall' : 'Add a rock') : `Add a ${noun}`

    // Portaled to document.body, same pattern as InfoTooltip.tsx -- the
    // Footer is also position:fixed at the page root and would otherwise
    // fight this sheet for paint order at the bottom of the viewport where
    // this bottom-sheet layout and the footer's fixed position collide.
    return createPortal((
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
            {toast && <Toast {...toast} />}
            <div className="relative bg-panel border border-border rounded-t-[20px] sm:rounded-[20px] w-full sm:max-w-[440px] h-[92vh] sm:h-auto sm:max-h-[calc(100vh-48px)] flex flex-col overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6)] font-sans">
                <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-4">
                    <h2 className="font-serif text-[21px] font-bold text-text">{title}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 w-11 h-11 -m-1.5 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-text-secondary cursor-pointer bg-transparent border-0">
                        <X size={20} className="shrink-0" />
                    </button>
                </div>

                <div role="tablist" className="shrink-0 flex gap-0 mx-5 mt-3 p-[3px] bg-surface border border-border rounded-[10px]">
                    {(['problem', 'spot', 'rock'] as AddIntent[]).map(i => (
                        <button
                            key={i}
                            type="button"
                            role="tab"
                            aria-selected={intent === i}
                            onClick={() => { setIntent(i); setProblemBanner(null); setSpotBanner(null); setRockBanner(null) }}
                            className={`flex-1 min-h-[38px] rounded-lg text-[13px] font-medium cursor-pointer border-0 whitespace-nowrap px-1 ${intent === i ? 'bg-panel text-text shadow-sm' : 'bg-transparent text-text-muted'}`}
                        >
                            {i === 'problem' ? 'A problem' : i === 'spot' ? 'A spot' : 'A rock'}
                        </button>
                    ))}
                </div>

                <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 pt-3.5 pb-5">
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
