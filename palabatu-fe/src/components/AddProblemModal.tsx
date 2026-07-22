import { api } from '../lib/api.js'
import { useState, useEffect } from 'react'
import { useMapEvents } from 'react-leaflet'
import type { LeafletMouseEvent } from 'leaflet'
import type { NewProblem, ProblemRow } from '../types/problem.js'
import type { Shape } from '../types/annotation.js'
import { useAuth } from '../lib/useAuth.js'
import Toast, { type ToastProps } from './Toast.js'
import { GRADE_SCALES, type ProblemType } from '../lib/constants.js'
import TopoAnnotationEditor from './topo-annotations/TopoAnnotationEditor.js'
import { X, Pencil, ChevronDown, ChevronUp, MapPin } from 'lucide-react'

type Props = {
    onClose: () => void
    onAdded: (problem: ProblemRow) => void
    newProblem: NewProblem
    setNewProblem: (val: NewProblem) => void
    isPicking: boolean
    setIsPicking: (val: boolean) => void
}

export function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e: LeafletMouseEvent) {
            onPick(e.latlng.lat, e.latlng.lng)
        }
    })
    return null
}

const inputClass = "w-full bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none"
const labelClass = "text-[11px] text-text-dim tracking-[0.1em] uppercase mb-1.5"
const segmentBtnClass = (active: boolean) =>
    `flex-1 py-[7px] text-xs font-sans border-0 rounded-lg cursor-pointer transition-all ${active ? 'bg-accent/15 text-accent font-bold' : 'bg-transparent text-text-dim font-normal'}`

export default function AddProblemModal({ onClose, onAdded, newProblem, setNewProblem, isPicking, setIsPicking }: Props) {
    const { user } = useAuth()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [toast, setToast] = useState<ToastProps | null>(null)
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) })

    // Parallel to imageFiles/imagePreviews (same index). Photos aren't
    // uploaded to Cloudinary — and the problem doesn't exist yet — until
    // final submit, so there's no problem_id/URL to key a real annotation
    // row on yet; drawings are staged here and persisted in handleSubmit
    // once both exist.
    const [draftAnnotations, setDraftAnnotations] = useState<Shape[][]>([])
    const [annotatingIndex, setAnnotatingIndex] = useState<number | null>(null)

    // Grade state
    const [problemType, setProblemType] = useState<ProblemType>('boulder')
    const [gradeScale, setGradeScale] = useState<string>('V-Scale')
    const [isRange, setIsRange] = useState(false)
    const [gradeFrom, setGradeFrom] = useState('')
    const [gradeTo, setGradeTo] = useState('')
    const [gradeExpanded, setGradeExpanded] = useState(false)

    const currentScales = GRADE_SCALES[problemType] as Record<string, readonly string[]>;
    const grades: readonly string[] = currentScales[gradeScale] || [];

    // Reset scale when type changes
    useEffect(() => {
        const defaultScale = problemType === 'boulder' ? 'V-Scale' : 'YDS'
        setGradeScale(defaultScale)
        setGradeFrom('')
        setGradeTo('')
        setNewProblem({ ...newProblem, grade: '' })
    }, [problemType])

    // Reset grades when scale changes
    useEffect(() => {
        setGradeFrom('')
        setGradeTo('')
        setNewProblem({ ...newProblem, grade: '' })
    }, [gradeScale])

    // Sync grade string to newProblem
    useEffect(() => {
        if (!gradeFrom) return
        const gradeStr = isRange && gradeTo ? `${gradeFrom}-${gradeTo}` : gradeFrom
        setNewProblem({ ...newProblem, grade: gradeStr })
    }, [gradeFrom, gradeTo, isRange])

    const handleGradePick = (g: string) => {
        if (!isRange) {
            setGradeFrom(g)
            setGradeTo('')
            return
        }
        // Range: pick from first, then to
        if (!gradeFrom || (gradeFrom && gradeTo)) {
            setGradeFrom(g)
            setGradeTo('')
        } else {
            // Enforce order: from must be lower index than to
            const fromIdx = grades.indexOf(gradeFrom)
            const toIdx = grades.indexOf(g)
            if (toIdx > fromIdx) setGradeTo(g)
            else { setGradeFrom(g); setGradeTo('') } // restart if picked lower
        }
    }

    const handleSubmit = async () => {
        if (!newProblem.name || newProblem.lat === null || newProblem.lng === null) {
            showError('Please fill in name and pick a location on the map');
            return;
        }
        setIsSubmitting(true);

        const uploadedUrls: string[] = [];
        const uploadedDrafts: (Shape[] | undefined)[] = [];
        if (newProblem.imageFiles.length > 0) {
            const uploadPromises = newProblem.imageFiles.map(file => {
                const formData = new FormData();
                formData.append('image', file);
                return api.upload('/api/upload/topo', formData);
            });

            const result = await Promise.all(uploadPromises);
            // Pair each result with its original index BEFORE filtering out
            // failures, so a failed upload can't shift a later photo's draft
            // annotation onto the wrong surviving URL.
            result.forEach((res, idx) => {
                if (!res.error) {
                    uploadedUrls.push(res.url);
                    uploadedDrafts.push(draftAnnotations[idx]);
                }
            });
        }

        const data = await api.post('/api/problems', { ...newProblem, image_urls: uploadedUrls });
        setIsSubmitting(false);

        if (data.error) { showError(data.error); return; }

        // Persist staged drawings now that the problem (and its final image
        // URLs) exist. Best-effort — the problem itself already succeeded,
        // so an annotation save failure here shouldn't block finishing add.
        const annotationSaves = uploadedUrls
            .map((url, idx) => ({ url, shapes: uploadedDrafts[idx] }))
            .filter((pair): pair is { url: string; shapes: Shape[] } => !!pair.shapes && pair.shapes.length > 0)
            .map(({ url, shapes }) => api.put(`/api/problems/${data.id}/annotations`, { url, data: shapes }));
        if (annotationSaves.length > 0) {
            await Promise.all(annotationSaves).catch(e => console.error('Failed to save one or more annotations', e));
        }

        onAdded({
            ...data,
            image_urls: uploadedUrls,
            created_by: user?.id,
            creator_name: user?.username,
            send_count: 0
        })
        onClose();
    }

    if (isPicking) {
        return (
            <div className="fixed bottom-8 left-8 bg-panel/[0.97] border border-accent rounded-2xl px-5 py-4 z-[1000] font-sans shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col gap-2.5 min-w-[220px]">
                <p className="text-[13px] text-text font-medium flex items-center gap-1.5">
                    <MapPin size={14} className="shrink-0" /> Click on the map to set location
                </p>
                <button onClick={() => setIsPicking(false)} className="px-3.5 py-[7px] bg-transparent border border-border rounded-lg text-text-dim text-xs cursor-pointer">Cancel</button>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center p-6">
            {toast && <Toast {...toast} />}
            <div className="bg-panel border border-border rounded-[20px] w-full max-w-[440px] max-h-[calc(100vh-48px)] flex flex-col shadow-[0_40px_80px_rgba(0,0,0,0.6)] font-sans">
                <h2 className="font-serif text-[22px] font-black text-text pt-4 px-8 pb-2.5 shrink-0">Add Problem</h2>

                <div className="overflow-y-auto min-h-0 flex-1 px-8 pb-4 flex flex-col gap-4">
                    {/* Multi-Image Picker */}
                    <div>
                        <div className={labelClass}>Topo Photos</div>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {newProblem.imagePreviews.map((preview, idx) => (
                                <div key={idx} className="relative min-w-[100px] h-[100px] rounded-[10px] overflow-hidden shrink-0">
                                    <img src={preview} className="w-full h-full object-cover" alt="Preview" />
                                    <button
                                        onClick={() => {
                                            const newFiles = [...newProblem.imageFiles];
                                            const newPreviews = [...newProblem.imagePreviews];
                                            newFiles.splice(idx, 1);
                                            newPreviews.splice(idx, 1);
                                            setNewProblem({ ...newProblem, imageFiles: newFiles, imagePreviews: newPreviews });
                                            const newDrafts = [...draftAnnotations];
                                            newDrafts.splice(idx, 1);
                                            setDraftAnnotations(newDrafts);
                                        }}
                                        className="absolute top-1 right-1 bg-black/60 text-white border-0 rounded-full w-6 h-6 cursor-pointer flex items-center justify-center"
                                        aria-label="Remove photo"
                                    ><X size={14} className="shrink-0" /></button>
                                    <button
                                        onClick={() => setAnnotatingIndex(idx)}
                                        title="Annotate route"
                                        aria-label="Annotate route"
                                        className={`absolute bottom-1 left-1 ${(draftAnnotations[idx]?.length ?? 0) > 0 ? 'bg-accent/90' : 'bg-black/60'} text-white border-0 rounded-full w-6 h-6 cursor-pointer flex items-center justify-center`}
                                    ><Pencil size={12} className="shrink-0" /></button>
                                </div>
                            ))}

                            <label className="min-w-[100px] h-[100px] bg-surface border border-dashed border-text-faint rounded-[10px] cursor-pointer flex flex-col items-center justify-center text-text-dim text-xl shrink-0">
                                +
                                <span className="text-[10px] mt-1">Add Photo</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple // <-- Allows selecting multiple files at once!
                                    className="hidden"
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        const previews = files.map(f => URL.createObjectURL(f));
                                        setNewProblem({
                                            ...newProblem,
                                            imageFiles: [...newProblem.imageFiles, ...files],
                                            imagePreviews: [...newProblem.imagePreviews, ...previews]
                                        });
                                        setDraftAnnotations([...draftAnnotations, ...files.map(() => [])]);
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <div className={labelClass}>Problem Name *</div>
                        <input
                            value={newProblem.name}
                            onChange={e => setNewProblem({ ...newProblem, name: e.target.value })}
                            placeholder="e.g. Slab Mantap"
                            className={inputClass}
                        />
                    </div>

                    {/* Grade */}
                    <div>
                        <div
                            onClick={() => setGradeExpanded(v => !v)}
                            className="flex items-center justify-between cursor-pointer"
                        >
                            <div className="text-[11px] text-text-dim tracking-[0.1em] uppercase">Grade</div>
                            <div className="flex items-center gap-1.5">
                                <span className={`text-xs ${newProblem.grade ? 'text-accent' : 'text-text-dim'}`}>
                                    {isRange
                                        ? gradeFrom && gradeTo ? `${gradeFrom} – ${gradeTo}` : gradeFrom ? `From ${gradeFrom}…` : 'Pick a range'
                                        : newProblem.grade || 'Not set'}
                                </span>
                                {gradeExpanded ? <ChevronUp size={14} className="shrink-0 text-text-dim" /> : <ChevronDown size={14} className="shrink-0 text-text-dim" />}
                            </div>
                        </div>

                        {gradeExpanded && (
                            <div className="mt-2.5">
                                {/* Problem Type toggle */}
                                <div className="flex gap-1 bg-surface border border-border rounded-[10px] p-1 mb-2.5">
                                    {(['boulder', 'rope'] as ProblemType[]).map(t => (
                                        <button key={t} onClick={() => setProblemType(t)} className={segmentBtnClass(problemType === t)}>
                                            {t === 'boulder' ? 'Boulder' : 'Rope'}
                                        </button>
                                    ))}
                                </div>

                                {/* Scale toggle */}
                                <div className="flex gap-1 bg-surface border border-border rounded-[10px] p-1 mb-2.5">
                                    {Object.keys(GRADE_SCALES[problemType]).map(scale => (
                                        <button key={scale} onClick={() => setGradeScale(scale)} className={segmentBtnClass(gradeScale === scale)}>
                                            {scale}
                                        </button>
                                    ))}
                                </div>

                                {/* Range toggle */}
                                <div className="flex items-center justify-between mb-2.5">
                                    <span className="text-xs text-text-dim">
                                        {isRange
                                            ? gradeFrom && gradeTo ? `Range: ${gradeFrom} – ${gradeTo}` : gradeFrom ? `From ${gradeFrom}, pick upper…` : 'Pick lower grade first'
                                            : newProblem.grade ? `Selected: ${newProblem.grade}` : 'Pick a grade'}
                                    </span>
                                    <button onClick={() => { setIsRange(r => !r); setGradeFrom(''); setGradeTo('') }}
                                        className={`text-[11px] px-2.5 py-1 rounded-full cursor-pointer font-sans transition-all border ${isRange ? 'bg-accent/15 border-accent text-accent' : 'bg-transparent border-border text-text-dim'}`}>
                                        Range
                                    </button>
                                </div>

                                {/* Grade pills */}
                                <div className="flex gap-1.5 flex-wrap">
                                    {grades.map(g => {
                                        const isFrom = g === gradeFrom
                                        const isTo = g === gradeTo
                                        const inRange = isRange && gradeFrom && gradeTo
                                            ? grades.indexOf(g) > grades.indexOf(gradeFrom) && grades.indexOf(g) < grades.indexOf(gradeTo)
                                            : false
                                        const active = isFrom || isTo || inRange

                                        return (
                                            <button key={g} onClick={() => handleGradePick(g)} className={`py-1.5 px-3 rounded-full text-xs font-sans cursor-pointer transition-all border ${active ? 'border-accent text-accent' : 'border-border text-text-dim'} ${isFrom || isTo ? 'bg-accent/20' : inRange ? 'bg-accent/[0.08]' : 'bg-transparent'}`}>{g}</button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Location name */}
                    <div>
                        <div className={labelClass}>Location Name</div>
                        <input
                            value={newProblem.location}
                            onChange={e => setNewProblem({ ...newProblem, location: e.target.value })}
                            placeholder="e.g. Parang, Jawa Barat"
                            className={inputClass}
                        />
                    </div>

                    {/* Lat Lng picker */}
                    <div>
                        <div className={labelClass}>Location on Map *</div>
                        {newProblem.lat ? (
                            <div className="flex gap-2 items-center">
                                <div className="flex-1 px-3.5 py-2.5 bg-associate/10 border border-associate rounded-[10px] text-associate font-sans text-[13px] flex items-center gap-1.5">
                                    <MapPin size={13} className="shrink-0" /> {newProblem.lat.toFixed(4)}, {newProblem.lng?.toFixed(4)}
                                </div>
                                <button onClick={() => setIsPicking(true)} className="px-3.5 py-2.5 bg-transparent border border-border rounded-[10px] cursor-pointer text-text-muted font-sans text-xs whitespace-nowrap transition-all flex items-center gap-1.5">
                                    <Pencil size={14} className="shrink-0" /> Edit
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => setIsPicking(true)} className="w-full py-2.5 bg-transparent border border-border rounded-[10px] cursor-pointer text-text-dim font-sans text-[13px] transition-all flex items-center justify-center gap-1.5">
                                <MapPin size={14} className="shrink-0" /> Click to pick on map
                            </button>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 px-8 py-4 shrink-0 border-t border-border">
                    <button onClick={onClose} className="flex-1 py-[11px] bg-transparent border border-border rounded-[10px] text-text-dim font-sans text-sm cursor-pointer">Cancel</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className={`flex-[2] py-[11px] rounded-[10px] border-0 text-on-accent font-sans text-sm font-medium cursor-pointer shadow-[0_2px_12px_rgba(200,122,48,0.3)] bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))] ${isSubmitting ? 'opacity-50' : 'opacity-100'}`}>{isSubmitting ? 'Submitting...' : 'Add Problem'}</button>
                </div>
            </div>

            {annotatingIndex !== null && newProblem.imagePreviews[annotatingIndex] && (
                <TopoAnnotationEditor
                    url={newProblem.imagePreviews[annotatingIndex]}
                    initialShapes={draftAnnotations[annotatingIndex] ?? []}
                    onCancel={() => setAnnotatingIndex(null)}
                    onSaved={(shapes) => {
                        const next = [...draftAnnotations];
                        next[annotatingIndex] = shapes;
                        setDraftAnnotations(next);
                        setAnnotatingIndex(null);
                    }}
                />
            )}
        </div>
    )
}
