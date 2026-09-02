import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronUp, ChevronDown, MapPin, AlertTriangle, X } from 'lucide-react'
import { api } from '../lib/api.js'
import { invalidateCragCache } from '../lib/cragCache.js'
import type { CragListItem } from '../types/crag.js'
import type { Approach, CreateApproachRequest, StartType } from '../types/approach.js'
import { START_TYPE_LABELS } from '../types/approach.js'
import type { TopoUploadResponse } from '../types/problem.js'
import type { ErrorResponse } from '../types/apitypes.js'
import Toast, { type ToastProps } from '../components/Toast.js'

const labelClass = "block text-[12.5px] font-medium text-text-muted mb-2"
const inputClass = "w-full min-h-11 bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none focus:border-accent"

type StepDraft = {
    file: File
    preview: string
    caption: string
    lat: number | null
    lng: number | null
    careful: boolean
}

// "The way in" -- builds one approach and its steps, then submits once
// (handoff.md decision 21: "photos first, captions second... reorderable",
// done at home on wifi, not at the crag). The reading view (
// ApproachReadingPage) is the deliverable; this is the secondary,
// build-it-later half.
export default function ApproachCaptureView() {
    const { id: cragId } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [crag, setCrag] = useState<CragListItem | null>(null)
    const [name, setName] = useState('')
    const [startType, setStartType] = useState<StartType>('angkot')
    const [durationMinutes, setDurationMinutes] = useState('')
    const [steps, setSteps] = useState<StepDraft[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [toast, setToast] = useState<ToastProps | null>(null)
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) })

    useEffect(() => {
        if (!cragId) return
        api.get<CragListItem | ErrorResponse>(`/api/crags/${cragId}`).then(res => { if (!('error' in res)) setCrag(res) })
    }, [cragId])

    const addPhotos = (files: File[]) => {
        setSteps(prev => [...prev, ...files.map(file => ({ file, preview: URL.createObjectURL(file), caption: '', lat: null, lng: null, careful: false }))])
    }
    const updateStep = (idx: number, patch: Partial<StepDraft>) => setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
    const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx))
    const moveStep = (idx: number, dir: -1 | 1) => setSteps(prev => {
        const target = idx + dir
        if (target < 0 || target >= prev.length) return prev
        const next = [...prev]
        const tmp = next[idx]!
        next[idx] = next[target]!
        next[target] = tmp
        return next
    })
    const togglePin = (idx: number) => {
        const s = steps[idx]
        if (!s) return
        if (s.lat != null) { updateStep(idx, { lat: null, lng: null }); return }
        if (!navigator.geolocation) return
        navigator.geolocation.getCurrentPosition(
            pos => updateStep(idx, { lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => showError('Could not get your location')
        )
    }

    const ok = steps.length > 0 && steps.every(s => s.caption.trim() !== '')

    const handleSubmit = async () => {
        if (!cragId) return
        if (!ok) { showError(steps.length === 0 ? 'Add at least one photo from the walk' : 'Every step needs a caption'); return }
        setSubmitting(true)
        try {
            const uploaded = await Promise.all(steps.map(async s => {
                const formData = new FormData()
                formData.append('image', s.file)
                const res = await api.upload<Partial<TopoUploadResponse & ErrorResponse>>('/api/upload/topo', formData)
                return res.url ?? null
            }))
            if (uploaded.some(u => !u)) { showError('Some photos failed to upload -- try again'); return }
            const body: CreateApproachRequest = {
                crag_id: cragId, name, start_type: startType,
                duration_minutes: durationMinutes.trim() ? Number(durationMinutes) : null,
                steps: steps.map((s, idx) => ({ photo_url: uploaded[idx]!, caption: s.caption, lat: s.lat, lng: s.lng, careful_flag: s.careful })),
            }
            const res = await api.post<Approach | ErrorResponse>('/api/approaches', body)
            if ('error' in res) { showError(res.error); return }
            invalidateCragCache()
            navigate(`/crags/${cragId}`)
        } finally { setSubmitting(false) }
    }

    return (
        <div className="min-h-[var(--content-h)] bg-ink font-sans px-6 pt-6 pb-32">
            {toast && <Toast {...toast} />}
            <div className="max-w-[560px] mx-auto flex flex-col gap-6">
                <div>
                    <h1 className="font-serif text-2xl font-black text-text">The way in</h1>
                    <p className="text-sm text-text-muted mt-1">{crag ? `${crag.name} · ` : ''}photograph the walk so the next person finds it</p>
                </div>

                <div>
                    <label className={labelClass}>Where does this start?</label>
                    <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(START_TYPE_LABELS) as StartType[]).map(t => (
                            <button
                                key={t}
                                type="button"
                                aria-pressed={startType === t}
                                onClick={() => setStartType(t)}
                                className={`min-h-11 px-3.5 rounded-lg text-sm font-medium border cursor-pointer ${startType === t ? 'bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))] border-transparent text-on-accent' : 'bg-surface border-border text-text-secondary hover:border-accent'}`}
                            >
                                {START_TYPE_LABELS[t]}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-text-muted mt-2">Most guidebooks assume you drove. Plenty of people here don't.</p>
                </div>

                <div>
                    <label className={labelClass}>What do you call this way in? <span className="font-normal opacity-85">&mdash; optional</span></label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder={`dari ${START_TYPE_LABELS[startType].toLowerCase()}`} className={inputClass} />
                </div>

                <div>
                    <label className={labelClass}>How long does it take? <span className="font-normal opacity-85">&mdash; roughly, in minutes</span></label>
                    <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} placeholder="15" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass}>The walk, in order</label>
                    <div className="flex flex-col gap-2.5">
                        {steps.map((s, idx) => (
                            <div key={idx} className="flex gap-2.5 p-2.5 bg-surface border border-border rounded-[10px]">
                                <div className="shrink-0 flex flex-col items-center gap-1">
                                    <button type="button" onClick={() => moveStep(idx, -1)} disabled={idx === 0} aria-label="Move up" className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted bg-transparent border-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:text-text-secondary">
                                        <ChevronUp size={15} className="shrink-0" />
                                    </button>
                                    <span className="text-xs text-text-muted">{idx + 1}</span>
                                    <button type="button" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} aria-label="Move down" className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted bg-transparent border-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:text-text-secondary">
                                        <ChevronDown size={15} className="shrink-0" />
                                    </button>
                                </div>
                                <div className="shrink-0 w-16 h-20 rounded-[8px] overflow-hidden border border-border bg-panel">
                                    <img src={s.preview} alt={`Step ${idx + 1}`} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                    <input
                                        value={s.caption}
                                        onChange={e => updateStep(idx, { caption: e.target.value })}
                                        placeholder="what do you see here?"
                                        className="w-full min-h-[38px] bg-panel border border-border rounded-lg px-2.5 py-2 text-text-secondary text-[13.5px] outline-none focus:border-accent"
                                    />
                                    <div className="flex gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => togglePin(idx)}
                                            aria-pressed={s.lat != null}
                                            className={`inline-flex items-center gap-1 min-h-[34px] px-2.5 rounded-lg text-[11.5px] font-medium border cursor-pointer ${s.lat != null ? 'border-associate/45 text-associate' : 'border-border text-text-muted hover:text-text-secondary'}`}
                                        >
                                            <MapPin size={12} className="shrink-0" /> {s.lat != null ? 'pinned' : 'pin it'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateStep(idx, { careful: !s.careful })}
                                            aria-pressed={s.careful}
                                            className={`inline-flex items-center gap-1 min-h-[34px] px-2.5 rounded-lg text-[11.5px] font-medium border cursor-pointer ${s.careful ? 'border-danger/45 text-danger' : 'border-border text-text-muted hover:text-text-secondary'}`}
                                        >
                                            <AlertTriangle size={12} className="shrink-0" /> careful here
                                        </button>
                                    </div>
                                </div>
                                <button type="button" onClick={() => removeStep(idx)} aria-label="Remove step" className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-text-muted bg-transparent border-0 cursor-pointer hover:text-danger">
                                    <X size={15} className="shrink-0" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <label className="block w-full min-h-11 border border-dashed border-border rounded-[10px] bg-surface text-text-secondary text-sm text-center py-5 cursor-pointer hover:border-accent mt-2.5">
                        + add photos from the walk
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
                            const files = Array.from(e.target.files || [])
                            e.target.value = ''
                            addPhotos(files)
                        }} />
                    </label>
                    <p className="text-xs text-text-muted mt-2">Pick them all at once, then caption. Use the arrows to reorder if they came out wrong.</p>
                </div>
            </div>

            {/* Portaled to document.body -- the global Footer is also
                position:fixed at the page root and otherwise wins the paint
                order at the bottom of the viewport, same fix as AddSheet. */}
            {createPortal((
                <div className="fixed bottom-0 left-0 right-0 z-[100] bg-panel border-t border-border px-6 py-3.5" style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}>
                    <div className="max-w-[560px] mx-auto">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!ok || submitting}
                            className="w-full min-h-12 rounded-[10px] border-0 text-on-accent font-medium text-[15.5px] cursor-pointer bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))] shadow-[0_2px_16px_rgba(200,122,48,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {submitting ? 'Saving...' : 'Save the way in'}
                        </button>
                        <p className="text-xs text-text-muted text-center mt-2">Do this at home on wifi &mdash; it's a lot of photos.</p>
                    </div>
                </div>
            ), document.body)}
        </div>
    )
}
