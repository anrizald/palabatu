import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import type { NewProblem } from '../../types/problem.js'
import type { Shape } from '../../types/annotation.js'
import { GRADE_SCALES, type ProblemType } from '../../lib/constants.js'
import TopoAnnotationEditor from '../topo-annotations/TopoAnnotationEditor.js'

const inputClass = "w-full bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none"
const labelClass = "text-[11px] text-text-dim tracking-[0.1em] uppercase mb-1.5"
const segmentBtnClass = (active: boolean) =>
    `flex-1 py-[7px] text-xs font-sans border-0 rounded-lg cursor-pointer transition-all ${active ? 'bg-accent/15 text-accent font-bold' : 'bg-transparent text-text-dim font-normal'}`

type ClimbStepProps = {
    problem: NewProblem
    setProblem: (v: NewProblem | ((p: NewProblem) => NewProblem)) => void
    /** The chosen rock's photos -- the existing boulder's image_urls, or
     * the new-rock draft's local preview URLs. Used only to pick which
     * photo to draw the line on; empty when the rock has no photo yet. */
    availablePhotos: string[]
    annotationTargetIndex: number | null
    setAnnotationTargetIndex: (i: number | null) => void
    annotationShapes: Shape[]
    setAnnotationShapes: (s: Shape[]) => void
    optionalExpanded: boolean
    setOptionalExpanded: (v: boolean) => void
}

// "Tell us about the climb" -- handoff.md's third add-flow step. Name and
// grade are the only required fields; everything else (who did it first,
// landing/spotting, descent, height, notes) is collapsed behind "more
// details" so a beginner isn't confronted with a wall of optional fields.
export default function ClimbStep({
    problem, setProblem, availablePhotos, annotationTargetIndex, setAnnotationTargetIndex,
    annotationShapes, setAnnotationShapes, optionalExpanded, setOptionalExpanded,
}: ClimbStepProps) {
    const [problemType, setProblemType] = useState<ProblemType>('boulder')
    const [gradeScale, setGradeScale] = useState<string>('V-Scale')
    const [isRange, setIsRange] = useState(false)
    const [gradeFrom, setGradeFrom] = useState('')
    const [gradeTo, setGradeTo] = useState('')
    const [gradeExpanded, setGradeExpanded] = useState(false)
    const [annotatingIndex, setAnnotatingIndex] = useState<number | null>(null)

    const currentScales = GRADE_SCALES[problemType] as Record<string, readonly string[]>
    const grades: readonly string[] = currentScales[gradeScale] || []

    useEffect(() => {
        const defaultScale = problemType === 'boulder' ? 'V-Scale' : 'YDS'
        setGradeScale(defaultScale)
        setGradeFrom('')
        setGradeTo('')
    }, [problemType])

    useEffect(() => {
        setGradeFrom('')
        setGradeTo('')
    }, [gradeScale])

    useEffect(() => {
        if (!gradeFrom) return
        const gradeStr = isRange && gradeTo ? `${gradeFrom}-${gradeTo}` : gradeFrom
        setProblem(prev => ({ ...prev, grade: gradeStr }))
        // setProblem intentionally excluded: only re-run when the picker's own selection changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gradeFrom, gradeTo, isRange])

    const handleGradePick = (g: string) => {
        if (!isRange) {
            setGradeFrom(g)
            setGradeTo('')
            return
        }
        if (!gradeFrom || (gradeFrom && gradeTo)) {
            setGradeFrom(g)
            setGradeTo('')
        } else {
            const fromIdx = grades.indexOf(gradeFrom)
            const toIdx = grades.indexOf(g)
            if (toIdx > fromIdx) setGradeTo(g)
            else { setGradeFrom(g); setGradeTo('') }
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="text-[13px] text-text-dim">Tell us about the climb.</p>

            <div>
                <div className={labelClass}>Problem Name *</div>
                <input
                    value={problem.name}
                    onChange={e => setProblem(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Slab Mantap"
                    className={inputClass}
                />
            </div>

            <div>
                <div onClick={() => setGradeExpanded(v => !v)} className="flex items-center justify-between cursor-pointer">
                    <div className="text-[11px] text-text-dim tracking-[0.1em] uppercase">Grade</div>
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${problem.grade ? 'text-accent' : 'text-text-dim'}`}>
                            {isRange
                                ? gradeFrom && gradeTo ? `${gradeFrom} – ${gradeTo}` : gradeFrom ? `From ${gradeFrom}…` : 'Pick a range'
                                : problem.grade || 'Not set'}
                        </span>
                        {gradeExpanded ? <ChevronUp size={14} className="shrink-0 text-text-dim" /> : <ChevronDown size={14} className="shrink-0 text-text-dim" />}
                    </div>
                </div>

                {gradeExpanded && (
                    <div className="mt-2.5">
                        <div className="flex gap-1 bg-surface border border-border rounded-[10px] p-1 mb-2.5">
                            {(['boulder', 'rope'] as ProblemType[]).map(t => (
                                <button key={t} onClick={() => setProblemType(t)} className={segmentBtnClass(problemType === t)}>
                                    {t === 'boulder' ? 'Boulder' : 'Rope'}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-1 bg-surface border border-border rounded-[10px] p-1 mb-2.5">
                            {Object.keys(GRADE_SCALES[problemType]).map(scale => (
                                <button key={scale} onClick={() => setGradeScale(scale)} className={segmentBtnClass(gradeScale === scale)}>
                                    {scale}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-xs text-text-dim">
                                {isRange
                                    ? gradeFrom && gradeTo ? `Range: ${gradeFrom} – ${gradeTo}` : gradeFrom ? `From ${gradeFrom}, pick upper…` : 'Pick lower grade first'
                                    : problem.grade ? `Selected: ${problem.grade}` : 'Pick a grade'}
                            </span>
                            <button onClick={() => { setIsRange(r => !r); setGradeFrom(''); setGradeTo('') }}
                                className={`text-[11px] px-2.5 py-1 rounded-full cursor-pointer font-sans transition-all border ${isRange ? 'bg-accent/15 border-accent text-accent' : 'bg-transparent border-border text-text-dim'}`}>
                                Range
                            </button>
                        </div>
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

            {availablePhotos.length > 0 && (
                <div>
                    <div className={labelClass}>Draw the line (optional)</div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {availablePhotos.map((url, idx) => (
                            <button
                                key={idx}
                                onClick={() => setAnnotatingIndex(idx)}
                                className="relative min-w-[90px] h-[90px] rounded-[10px] overflow-hidden shrink-0 border border-border cursor-pointer"
                            >
                                <img src={url} className="w-full h-full object-cover" alt="Rock" />
                                {annotationTargetIndex === idx && annotationShapes.length > 0 && (
                                    <div className="absolute inset-0 border-2 border-accent pointer-events-none" />
                                )}
                                <div className="absolute bottom-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center">
                                    <Pencil size={12} className="shrink-0" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <div onClick={() => setOptionalExpanded(!optionalExpanded)} className="flex items-center justify-between cursor-pointer">
                    <div className="text-[11px] text-text-dim tracking-[0.1em] uppercase">More details (optional)</div>
                    {optionalExpanded ? <ChevronUp size={14} className="shrink-0 text-text-dim" /> : <ChevronDown size={14} className="shrink-0 text-text-dim" />}
                </div>

                {optionalExpanded && (
                    <div className="mt-2.5 flex flex-col gap-3">
                        <div>
                            <div className={labelClass}>First ascent by</div>
                            <input value={problem.first_ascensionist} onChange={e => setProblem(prev => ({ ...prev, first_ascensionist: e.target.value }))} placeholder="Comma-separate multiple names" className={inputClass} />
                        </div>
                        <div>
                            <div className={labelClass}>Discovered by</div>
                            <input value={problem.discovered_by} onChange={e => setProblem(prev => ({ ...prev, discovered_by: e.target.value }))} placeholder="If different from first ascent" className={inputClass} />
                        </div>
                        <div>
                            <div className={labelClass}>Landing / spotting</div>
                            <input value={problem.landing_hazards} onChange={e => setProblem(prev => ({ ...prev, landing_hazards: e.target.value }))} placeholder="Pad placement, exposed landing..." className={inputClass} />
                        </div>
                        <div>
                            <div className={labelClass}>How to get down</div>
                            <input value={problem.descent} onChange={e => setProblem(prev => ({ ...prev, descent: e.target.value }))} placeholder="Descent notes" className={inputClass} />
                        </div>
                        <div>
                            <div className={labelClass}>Height (m)</div>
                            <input type="number" value={problem.height_m} onChange={e => setProblem(prev => ({ ...prev, height_m: e.target.value }))} placeholder="e.g. 4.5" className={inputClass} />
                        </div>
                        <div>
                            <div className={labelClass}>Anything else</div>
                            <textarea value={problem.notes} onChange={e => setProblem(prev => ({ ...prev, notes: e.target.value }))} rows={2} className={inputClass} />
                        </div>
                    </div>
                )}
            </div>

            {annotatingIndex !== null && availablePhotos[annotatingIndex] && (
                <TopoAnnotationEditor
                    url={availablePhotos[annotatingIndex]}
                    initialShapes={annotationTargetIndex === annotatingIndex ? annotationShapes : []}
                    onCancel={() => setAnnotatingIndex(null)}
                    onSaved={(shapes) => {
                        setAnnotationTargetIndex(annotatingIndex)
                        setAnnotationShapes(shapes)
                        setAnnotatingIndex(null)
                    }}
                />
            )}
        </div>
    )
}
