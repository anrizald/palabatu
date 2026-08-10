import { useState } from 'react'
import { GRADE_SCALES, boulderTypeToGradeType, type ProblemType } from '../../lib/constants.js'
import type { NewProblemDraft } from './types.js'

const inputClass = "w-full min-h-11 bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none focus:border-accent"
const labelClass = "block text-[12.5px] font-medium text-text-muted mb-1.5"

type ProblemFieldsProps = {
    draft: NewProblemDraft
    onChange: (v: NewProblemDraft) => void
    /** 'wall' when the resolved rock is a wall -- switches the grade scale
     * and the noun (handoff.md decision 1, closing open item 10). Absent
     * (no rock resolved yet, e.g. a brand-new spot) defaults to boulder. */
    boulderType: 'boulder' | 'wall'
    /** Whether the resolved rock already has a topo photo -- when true,
     * drawing is the primary action and uploading another shot is a small
     * afterthought (handoff.md decision 19, sharpened). */
    hasExistingTopo: boolean
    existingTopoUrl: string | null
    lineDrawn: boolean
    onOpenAnnotator: (url: string) => void
    /** True once a rock exists to draw on (either an existing one, or the
     * photo just staged for a new one) -- the whole "draw the line" surface
     * only appears once a photo exists. */
    noun: string
    moreOpen: boolean
    setMoreOpen: (v: boolean) => void
}

// "Tell us about the climb" -- name, grade, photo, more details. Name is
// the only required field (handoff.md's Add flow section). Grade ranges
// were part of the pre-restructure wizard and are not in this spec; the
// grade chips here are single-select, matching prototypes/add-flow-v2.html
// exactly (decision 19's tier-2 fix: no "no grade yet" chip, an unselected
// row already means that).
export default function ProblemFields({
    draft, onChange, boulderType, hasExistingTopo, existingTopoUrl, lineDrawn, onOpenAnnotator, noun, moreOpen, setMoreOpen,
}: ProblemFieldsProps) {
    const gradeType: ProblemType = boulderTypeToGradeType(boulderType)
    const scaleNames = Object.keys(GRADE_SCALES[gradeType])
    const [scaleIdx, setScaleIdx] = useState(0)
    const scaleName = scaleNames[Math.min(scaleIdx, scaleNames.length - 1)] as string
    const grades = (GRADE_SCALES[gradeType] as Record<string, readonly string[]>)[scaleName] ?? []

    const set = (patch: Partial<NewProblemDraft>) => onChange({ ...draft, ...patch })

    return (
        <div className="flex flex-col gap-4">
            <div>
                <label className={labelClass}>Name</label>
                <input value={draft.name} onChange={e => set({ name: e.target.value })} placeholder="Slab Mantap" className={inputClass} />
            </div>

            <div>
                <label className={labelClass}>Grade <span className="font-normal opacity-85">&mdash; skip it if it's still a project</span></label>
                <div className="flex flex-wrap gap-1.5">
                    {grades.map(g => (
                        <button
                            key={g}
                            type="button"
                            aria-pressed={draft.grade === g}
                            onClick={() => set({ grade: draft.grade === g ? '' : g })}
                            className={`min-h-11 min-w-11 px-3.5 rounded-lg text-sm font-medium border cursor-pointer ${draft.grade === g ? 'bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))] border-transparent text-on-accent' : 'bg-surface border-border text-text-secondary hover:border-accent'}`}
                        >
                            {g}
                        </button>
                    ))}
                    {scaleNames.length > 1 && (
                        <button
                            type="button"
                            onClick={() => setScaleIdx(i => (i + 1) % scaleNames.length)}
                            className="min-h-11 px-1 bg-transparent border-0 text-accent text-[13px] font-medium cursor-pointer"
                        >
                            {gradeType === 'rope' ? 'other scales' : 'more'}
                        </button>
                    )}
                </div>
                {gradeType === 'rope' && <p className="text-xs text-text-muted mt-1.5">{scaleName}, because this one's a wall.</p>}
            </div>

            <div>
                {hasExistingTopo && existingTopoUrl ? (
                    <>
                        <label className={labelClass}>Photo <span className="font-normal opacity-85">&mdash; this rock already has one</span></label>
                        <div className="border border-border rounded-[10px] overflow-hidden">
                            <div className="aspect-video bg-panel">
                                <img src={existingTopoUrl} alt="Rock" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface border-t border-border">
                                <span className="flex-1 text-xs text-text-muted">{lineDrawn ? 'your line is on it' : `every ${noun} here draws on this`}</span>
                                <button
                                    type="button"
                                    onClick={() => onOpenAnnotator(existingTopoUrl)}
                                    className={`min-h-11 px-3.5 rounded-lg text-[13px] font-medium border cursor-pointer whitespace-nowrap ${lineDrawn ? 'border-associate text-associate' : 'border-accent text-accent hover:bg-accent/10'}`}
                                >
                                    {lineDrawn ? 'Line drawn' : 'Draw your line'}
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-text-muted mt-1.5">Another angle is welcome, but the line goes on the shot above.</p>
                    </>
                ) : draft.photoPreview ? (
                    <>
                        <label className={labelClass}>Photo</label>
                        <div className="border border-border rounded-[10px] overflow-hidden">
                            <div className="aspect-video bg-panel">
                                <img src={draft.photoPreview} alt="Rock" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface border-t border-border">
                                <span className="flex-1 text-xs text-text-muted">this becomes the rock's photo</span>
                                <button
                                    type="button"
                                    onClick={() => onOpenAnnotator(draft.photoPreview!)}
                                    className={`min-h-11 px-3.5 rounded-lg text-[13px] font-medium border cursor-pointer whitespace-nowrap ${lineDrawn ? 'border-associate text-associate' : 'border-accent text-accent hover:bg-accent/10'}`}
                                >
                                    {lineDrawn ? 'Line drawn' : 'Draw your line'}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <label className={labelClass}>Photo <span className="font-normal opacity-85">&mdash; a wide shot of the rock</span></label>
                        <label className="block w-full min-h-11 border border-dashed border-border rounded-[10px] bg-surface text-text-secondary text-sm text-center py-5 cursor-pointer hover:border-accent">
                            + add a photo of the rock
                            <input type="file" accept="image/*" className="hidden" onChange={e => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                set({ photoFile: file, photoPreview: URL.createObjectURL(file) })
                            }} />
                        </label>
                        <p className="text-xs text-text-muted mt-1.5">The photo belongs to the rock. Every {noun} on it draws on the same picture.</p>
                    </>
                )}
            </div>

            <div className="border-t border-border pt-1">
                <button type="button" onClick={() => setMoreOpen(!moreOpen)} className="w-full min-h-11 flex items-center justify-between text-[13.5px] font-medium text-text-muted cursor-pointer bg-transparent border-0">
                    More details (optional)
                    <span className="text-text-muted">{moreOpen ? '−' : '+'}</span>
                </button>
                {moreOpen && (
                    <div className="flex flex-col gap-3 pt-1">
                        <div>
                            <label className={labelClass}>First ascent</label>
                            <input value={draft.first_ascensionist} onChange={e => set({ first_ascensionist: e.target.value })} placeholder="who climbed it first" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Discovered by</label>
                            <input value={draft.discovered_by} onChange={e => set({ discovered_by: e.target.value })} placeholder="if different from first ascent" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Landing / spotting</label>
                            <input value={draft.landing_hazards} onChange={e => set({ landing_hazards: e.target.value })} placeholder="pad placement, exposed landing" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Getting down</label>
                            <input value={draft.descent} onChange={e => set({ descent: e.target.value })} placeholder="descent notes" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Height (m)</label>
                            <input type="number" value={draft.height_m} onChange={e => set({ height_m: e.target.value })} placeholder="4" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Anything else</label>
                            <textarea value={draft.notes} onChange={e => set({ notes: e.target.value })} rows={2} placeholder="beta, conditions, when it's dry" className={inputClass} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
