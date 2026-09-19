import { GRADE_SCALES, COMMITMENT_GRADES, MAX_PITCH_COUNT } from '../lib/constants.js'
import { COMMITMENT_HELP, documentedGap, nextPitchNumber, type PitchFormRow, type PitchFormState } from '../lib/pitches.js'

const inputClass = "w-full min-h-11 bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none focus:border-accent"
const labelClass = "block text-[12.5px] font-medium text-text-muted mb-1.5"

type PitchFieldsProps = {
    value: PitchFormState
    onChange: (v: PitchFormState) => void
}

// The multi-pitch part of a route form: how many pitches, an optional overall
// (commitment) grade, and an optional pitch-by-pitch breakdown. Only rendered
// for a route on a wall -- the callers own that gate, since it depends on
// which rock the route is on. Shared by the add sheet's ProblemFields and the
// problem page's edit form (handoff.md open item 14).
//
// The breakdown never has to add up to the count: "roughly 10 pitches" is
// often known while the per-pitch detail is not, so a route can say 10 and
// list 4, and the gap is stated rather than treated as an error.
export default function PitchFields({ value, onChange }: PitchFieldsProps) {
    const set = (patch: Partial<PitchFormState>) => onChange({ ...value, ...patch })
    const isMulti = value.pitch_count.trim() !== ''
    const countNumber = Number(value.pitch_count)
    const gap = documentedGap(Number.isInteger(countNumber) ? countNumber : null, value.pitches.length)

    const setRow = (index: number, patch: Partial<PitchFormRow>) =>
        set({ pitches: value.pitches.map((r, i) => i === index ? { ...r, ...patch } : r) })
    const removeRow = (index: number) => set({ pitches: value.pitches.filter((_, i) => i !== index) })
    const addRow = () =>
        set({ pitches: [...value.pitches, { pitch_number: String(nextPitchNumber(value.pitches)), grade: '', length_m: '', notes: '' }] })

    return (
        <div className="flex flex-col gap-4">
            <div>
                <label className={labelClass}>Pitches <span className="font-normal opacity-85">(leave blank if it's a single pitch)</span></label>
                <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={MAX_PITCH_COUNT}
                    step={1}
                    value={value.pitch_count}
                    onChange={e => set({ pitch_count: e.target.value })}
                    placeholder="e.g. 10"
                    className={inputClass}
                />
                <p className="text-xs text-text-muted mt-1.5">
                    The grade above is the hardest pitch. An estimate is fine here, you can add the pitches one by one below.
                </p>
            </div>

            {isMulti && (
                <>
                    <div>
                        <label className={labelClass}>Commitment grade <span className="font-normal opacity-85">(optional)</span></label>
                        <div className="flex flex-wrap gap-1.5">
                            {COMMITMENT_GRADES.map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    aria-pressed={value.commitment_grade === g}
                                    onClick={() => set({ commitment_grade: value.commitment_grade === g ? '' : g })}
                                    className={`min-h-11 min-w-11 px-3.5 rounded-lg text-sm font-medium border cursor-pointer ${value.commitment_grade === g ? 'bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))] border-transparent text-on-accent' : 'bg-surface border-border text-text-secondary hover:border-accent'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-text-muted mt-1.5">{COMMITMENT_HELP}</p>
                    </div>

                    <div>
                        <label className={labelClass}>Pitch by pitch <span className="font-normal opacity-85">(optional)</span></label>
                        <div className="flex flex-col gap-2.5">
                            {value.pitches.map((row, i) => (
                                <div key={i} className="flex flex-col gap-2 bg-surface border border-border rounded-[10px] p-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[12.5px] font-medium text-text-muted shrink-0">Pitch</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            max={MAX_PITCH_COUNT}
                                            step={1}
                                            aria-label="Pitch number"
                                            value={row.pitch_number}
                                            onChange={e => setRow(i, { pitch_number: e.target.value })}
                                            className={`${inputClass} !w-20 shrink-0`}
                                        />
                                        <span className="flex-1" />
                                        <button
                                            type="button"
                                            onClick={() => removeRow(i)}
                                            className="min-h-11 px-2 text-[13px] text-text-muted underline bg-transparent border-0 cursor-pointer shrink-0"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <select
                                        aria-label="Pitch grade"
                                        value={row.grade}
                                        onChange={e => setRow(i, { grade: e.target.value })}
                                        className={`${inputClass} max-w-full min-w-0`}
                                    >
                                        <option value="">Grade</option>
                                        {Object.entries(GRADE_SCALES.rope).map(([scale, grades]) => (
                                            <optgroup key={scale} label={scale}>
                                                {grades.map(g => <option key={g} value={g}>{g}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        step="any"
                                        aria-label="Pitch length in metres"
                                        value={row.length_m}
                                        onChange={e => setRow(i, { length_m: e.target.value })}
                                        placeholder="Length (m), optional"
                                        className={inputClass}
                                    />
                                    <input
                                        aria-label="Pitch notes"
                                        value={row.notes}
                                        onChange={e => setRow(i, { notes: e.target.value })}
                                        placeholder="Notes, optional"
                                        className={inputClass}
                                    />
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={addRow}
                            className="inline-flex items-center gap-1.5 min-h-11 mt-1 text-[13px] font-medium text-accent bg-transparent border-0 cursor-pointer hover:underline"
                        >
                            + add a pitch
                        </button>
                        {gap && <p className="text-xs text-text-muted">{gap}, and that is fine.</p>}
                    </div>
                </>
            )}
        </div>
    )
}
