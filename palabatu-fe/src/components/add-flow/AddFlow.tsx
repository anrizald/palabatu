import { useEffect, useState } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { api } from '../../lib/api.js'
import { useAuth } from '../../lib/useAuth.js'
import { getAllCrags, fetchBouldersForCrag, invalidateCragCache } from '../../lib/cragCache.js'
import type { CragListItem, CragRequest, Crag } from '../../types/crag.js'
import type { BoulderListItem, CreateBoulderRequest, Boulder } from '../../types/boulder.js'
import type { NewProblem, CreateProblemRequest, ProblemSummary, ProblemListItem, TopoUploadResponse } from '../../types/problem.js'
import type { Shape } from '../../types/annotation.js'
import type { ErrorResponse } from '../../types/apitypes.js'
import type { NewSpotDraft, NewRockDraft } from './types.js'
import SpotStep from './SpotStep.js'
import RockStep from './RockStep.js'
import ClimbStep from './ClimbStep.js'
import Toast, { type ToastProps } from '../Toast.js'

type Step = 'spot' | 'rock' | 'climb'

const blankSpot: NewSpotDraft = { name: '', directions: '', access_notes: '' }
const blankRock: NewRockDraft = { name: '', rock_type: '', imageFiles: [], imagePreviews: [] }
const blankProblem: NewProblem = {
    name: '', grade: '', first_ascensionist: '', discovered_by: '',
    landing_hazards: '', descent: '', height_m: '', notes: '',
}

type AddFlowProps = {
    onClose: () => void
    onAdded: (problem: ProblemListItem) => void
    isPicking: boolean
    setIsPicking: (v: boolean) => void
    pickedCoords: { lat: number; lng: number } | null
    /** Pre-seeds the wizard from a crag/boulder page's "+ Add" CTA, skipping
     * the steps that are already answered (handoff.md UX principle 4: never
     * ask a question that's already been answered). */
    initialCragId?: string
    initialBoulderId?: string
}

// Three short questions, never a hierarchy picker (handoff.md's "Add flow"
// and "UX principles" sections): "Where is it?" -> "Which rock?" ->
// "Tell us about the climb". Nothing is created against the backend until
// the final submit -- backing out of the wizard midway never leaves an
// orphan crag/boulder row.
export default function AddFlow({ onClose, onAdded, isPicking, setIsPicking, pickedCoords, initialCragId, initialBoulderId }: AddFlowProps) {
    const { user } = useAuth()
    const [toast, setToast] = useState<ToastProps | null>(null)
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) })

    const [step, setStep] = useState<Step>(initialBoulderId ? 'climb' : initialCragId ? 'rock' : 'spot')

    // Spot step state.
    const [crags, setCrags] = useState<CragListItem[]>([])
    const [cragId, setCragId] = useState<string | null>(initialCragId ?? null)
    const [creatingNewSpot, setCreatingNewSpot] = useState(false)
    const [newSpot, setNewSpot] = useState<NewSpotDraft>(blankSpot)

    // Rock step state.
    const [boulders, setBoulders] = useState<BoulderListItem[]>([])
    const [bouldersLoading, setBouldersLoading] = useState(false)
    const [boulderId, setBoulderId] = useState<string | null>(initialBoulderId ?? null)
    const [creatingNewRock, setCreatingNewRock] = useState(!!initialCragId && !initialBoulderId)
    const [newRock, setNewRock] = useState<NewRockDraft>(blankRock)
    // Photos to offer for "draw the line" on the climb step -- either the
    // existing boulder's photos, or the new rock's local previews.
    const [rockPhotos, setRockPhotos] = useState<string[]>([])

    // Climb step state.
    const [problem, setProblem] = useState<NewProblem>(blankProblem)
    const [annotationTargetIndex, setAnnotationTargetIndex] = useState<number | null>(null)
    const [annotationShapes, setAnnotationShapes] = useState<Shape[]>([])
    const [optionalExpanded, setOptionalExpanded] = useState(false)

    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => { getAllCrags().then(setCrags) }, [])

    // Load the pre-seeded boulder's photos when opened from a boulder
    // page's "+ Add a problem" CTA.
    useEffect(() => {
        if (!initialBoulderId) return
        api.get<Boulder | ErrorResponse>(`/api/boulders/${initialBoulderId}`).then(res => {
            if (!('error' in res)) setRockPhotos(res.image_urls)
        })
    }, [initialBoulderId])

    const loadBoulders = (id: string) => {
        setBouldersLoading(true)
        fetchBouldersForCrag(id).then(list => {
            setBoulders(list)
            setBouldersLoading(false)
            // Collapse the step when there's nothing to choose (handoff.md
            // UX principle 4) -- exactly one rock at this spot, so skip
            // straight to it.
            if (list.length === 1 && list[0]) {
                pickExistingBoulder(list[0])
            } else if (list.length === 0) {
                setCreatingNewRock(true)
            }
        })
    }

    const pickExistingCrag = (crag: CragListItem) => {
        setCragId(crag.id)
        setCreatingNewSpot(false)
        setStep('rock')
        loadBoulders(crag.id)
    }

    const startNewSpot = () => {
        setCreatingNewSpot(true)
    }

    const confirmNewSpot = () => {
        if (!newSpot.name.trim() || !pickedCoords) {
            showError('Please name the spot and pick a location on the map')
            return
        }
        setCragId(null) // null cragId + creatingNewSpot=true is the "create at submit" signal
        setStep('rock')
        setCreatingNewRock(true) // a brand-new spot has no rocks yet -- nothing to pick from
        setBoulders([])
    }

    const pickExistingBoulder = (boulder: BoulderListItem) => {
        setBoulderId(boulder.id)
        setCreatingNewRock(false)
        setRockPhotos(boulder.image_urls)
        setStep('climb')
    }

    const confirmNewRock = () => {
        setBoulderId(null) // null boulderId + creatingNewRock=true is the "create at submit" signal
        setRockPhotos(newRock.imagePreviews)
        setStep('climb')
    }

    const confirmNotSure = () => {
        setBoulderId(null)
        setCreatingNewRock(false)
        setRockPhotos([])
        setAnnotationTargetIndex(null)
        setAnnotationShapes([])
        setStep('climb')
    }

    const goBack = () => {
        if (step === 'climb') {
            setStep(initialBoulderId ? 'spot' : 'rock') // shouldn't normally happen when pre-seeded
            return
        }
        if (step === 'rock') {
            setStep('spot')
        }
    }

    const canGoBack = (step === 'rock' && !initialCragId) || (step === 'climb' && !initialBoulderId)

    const handlePrimaryAction = () => {
        if (step === 'spot') {
            if (creatingNewSpot) { confirmNewSpot(); return }
            showError('Pick a spot, or add a new one')
            return
        }
        if (step === 'rock') {
            if (creatingNewRock) { confirmNewRock(); return }
            showError('Pick a rock, add a new one, or say "not sure"')
            return
        }
        handleSubmit()
    }

    const handleSubmit = async () => {
        if (!problem.name.trim()) { showError('Please give the problem a name'); return }
        setIsSubmitting(true)

        try {
            // 1. Resolve the crag -- create it if this came from "add a new spot".
            let resolvedCragId = cragId
            if (!resolvedCragId) {
                if (!newSpot.name.trim() || !pickedCoords) {
                    showError('Please finish adding the new spot first')
                    setStep('spot')
                    return
                }
                const body: CragRequest = {
                    name: newSpot.name, lat: pickedCoords.lat, lng: pickedCoords.lng,
                    directions: newSpot.directions, access_notes: newSpot.access_notes,
                }
                const res = await api.post<Crag | ErrorResponse>('/api/crags', body)
                if ('error' in res) { showError(res.error); return }
                resolvedCragId = res.id
            }

            // 2. Resolve the boulder -- create it if this came from "it's a
            // new rock" or "not sure" (both leave boulderId null).
            let resolvedBoulderId = boulderId
            let newRockUploadedUrls: string[] = []
            if (!resolvedBoulderId) {
                if (newRock.imageFiles.length > 0) {
                    const uploads = await Promise.all(newRock.imageFiles.map(file => {
                        const formData = new FormData()
                        formData.append('image', file)
                        return api.upload<Partial<TopoUploadResponse & ErrorResponse>>('/api/upload/topo', formData)
                    }))
                    newRockUploadedUrls = uploads.filter((r): r is TopoUploadResponse => !!r.url).map(r => r.url)
                }
                const body: CreateBoulderRequest = {
                    crag_id: resolvedCragId, name: newRock.name, rock_type: newRock.rock_type,
                    lat: null, lng: null, image_urls: newRockUploadedUrls,
                }
                const res = await api.post<Boulder | ErrorResponse>('/api/boulders', body)
                if ('error' in res) { showError(res.error); return }
                resolvedBoulderId = res.id
            }

            // 3. Create the problem.
            const heightM = problem.height_m.trim() ? Number(problem.height_m) : null
            const createBody: CreateProblemRequest = {
                name: problem.name, grade: problem.grade, boulder_id: resolvedBoulderId,
                first_ascensionist: problem.first_ascensionist, discovered_by: problem.discovered_by,
                landing_hazards: problem.landing_hazards, descent: problem.descent,
                height_m: heightM, notes: problem.notes,
            }
            const problemRes = await api.post<ProblemSummary | ErrorResponse>('/api/problems', createBody)
            if ('error' in problemRes) { showError(problemRes.error); return }

            // 4. Best-effort: persist the staged line drawing now that both
            // the problem and its target photo exist. The target photo is
            // either one of the existing boulder's photos (rockPhotos) or
            // one just uploaded for a brand-new rock (newRockUploadedUrls) --
            // both were offered via the same rockPhotos array on the climb
            // step, so the index lines up with whichever list was shown.
            const targetPhotos = boulderId ? rockPhotos : newRockUploadedUrls
            const targetUrl = annotationTargetIndex !== null ? targetPhotos[annotationTargetIndex] : undefined
            if (targetUrl && annotationShapes.length > 0) {
                await api.put<unknown>(`/api/problems/${problemRes.id}/annotations`, { url: targetUrl, data: annotationShapes }).catch(() => {})
            }

            invalidateCragCache()

            // POST /problems's response (ProblemSummary) is deliberately
            // minimal -- fill the rest from what's already known client-side
            // (the logged-in user, the form fields just submitted), same as
            // the pre-restructure AddProblemModal did.
            onAdded({
                id: problemRes.id, name: problemRes.name, grade: problemRes.grade,
                crag_id: problemRes.crag_id, crag_name: null,
                boulder_id: problemRes.boulder_id, boulder_name: null,
                first_ascensionist: problem.first_ascensionist || null,
                discovered_by: problem.discovered_by || null,
                landing_hazards: problem.landing_hazards || null,
                descent: problem.descent || null,
                height_m: heightM,
                notes: problem.notes || null,
                created_by: user?.id ?? null,
                creator_name: user?.username ?? null,
                creator_slug: user?.slug ?? null,
                send_count: 0,
                created_at: new Date().toISOString(),
            })
            onClose()
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isPicking) {
        return (
            <div className="fixed bottom-8 left-8 bg-panel/[0.97] border border-accent rounded-2xl px-5 py-4 z-[1000] font-sans shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col gap-2.5 min-w-[220px]">
                <p className="text-[13px] text-text font-medium">Click on the map to drop the pin</p>
                <button onClick={() => setIsPicking(false)} className="px-3.5 py-[7px] bg-transparent border border-border rounded-lg text-text-dim text-xs cursor-pointer">Cancel</button>
            </div>
        )
    }

    const stepTitles: Record<Step, string> = { spot: 'Where is it?', rock: 'Which rock?', climb: 'Tell us about the climb' }
    const primaryLabel = step === 'climb' ? (isSubmitting ? 'Adding...' : 'Add Problem') : 'Continue'

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center p-6">
            {toast && <Toast {...toast} />}
            <div className="bg-panel border border-border rounded-[20px] w-full max-w-[440px] max-h-[calc(100vh-48px)] flex flex-col shadow-[0_40px_80px_rgba(0,0,0,0.6)] font-sans">
                <div className="flex items-center justify-between pt-4 px-8 pb-2.5 shrink-0">
                    <div className="flex items-center gap-2">
                        {canGoBack && (
                            <button onClick={goBack} className="text-text-dim cursor-pointer bg-transparent border-0 p-0 flex items-center" aria-label="Back">
                                <ChevronLeft size={18} className="shrink-0" />
                            </button>
                        )}
                        <h2 className="font-serif text-[20px] font-black text-text">{stepTitles[step]}</h2>
                    </div>
                    <button onClick={onClose} className="text-text-dim cursor-pointer bg-transparent border-0 p-0 flex items-center" aria-label="Close">
                        <X size={18} className="shrink-0" />
                    </button>
                </div>

                <div className="overflow-y-auto min-h-0 flex-1 px-8 pb-4">
                    {step === 'spot' && (
                        <SpotStep
                            crags={crags}
                            onPickExisting={pickExistingCrag}
                            isCreatingNew={creatingNewSpot}
                            onStartNew={startNewSpot}
                            onCancelNew={() => setCreatingNewSpot(false)}
                            newSpot={newSpot}
                            setNewSpot={setNewSpot}
                            pickedCoords={pickedCoords}
                            isPicking={isPicking}
                            onStartPicking={() => setIsPicking(true)}
                        />
                    )}
                    {step === 'rock' && (
                        <RockStep
                            boulders={boulders}
                            loading={bouldersLoading}
                            onPickExisting={pickExistingBoulder}
                            isCreatingNew={creatingNewRock}
                            onStartNew={() => setCreatingNewRock(true)}
                            onCancelNew={() => setCreatingNewRock(false)}
                            newRock={newRock}
                            setNewRock={setNewRock}
                            onNotSure={confirmNotSure}
                            hasNoExistingRocks={!cragId || boulders.length === 0}
                        />
                    )}
                    {step === 'climb' && (
                        <ClimbStep
                            problem={problem}
                            setProblem={setProblem}
                            availablePhotos={rockPhotos}
                            annotationTargetIndex={annotationTargetIndex}
                            setAnnotationTargetIndex={setAnnotationTargetIndex}
                            annotationShapes={annotationShapes}
                            setAnnotationShapes={setAnnotationShapes}
                            optionalExpanded={optionalExpanded}
                            setOptionalExpanded={setOptionalExpanded}
                        />
                    )}
                </div>

                <div className="flex gap-2.5 px-8 py-4 shrink-0 border-t border-border">
                    <button onClick={onClose} className="flex-1 py-[11px] bg-transparent border border-border rounded-[10px] text-text-dim font-sans text-sm cursor-pointer">Cancel</button>
                    <button
                        onClick={handlePrimaryAction}
                        disabled={isSubmitting}
                        className={`flex-[2] py-[11px] rounded-[10px] border-0 text-on-accent font-sans text-sm font-medium cursor-pointer shadow-[0_2px_12px_rgba(200,122,48,0.3)] bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))] ${isSubmitting ? 'opacity-50' : 'opacity-100'}`}
                    >
                        {primaryLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
