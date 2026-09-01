import { useEffect, useState } from 'react';
import { GRADE_SCALES, detectGradeScale, type ProblemType } from '../lib/constants.js';

export type ProblemEditFormFields = {
    name: string;
    grade: string;
    first_ascensionist: string;
    discovered_by: string;
    landing_hazards: string;
    descent: string;
    height_m: string;
    notes: string;
};

type ProblemEditFormProps = {
    form: ProblemEditFormFields;
    onChange: (form: ProblemEditFormFields) => void;
    onSave: () => void;
    onCancel: () => void;
    isProcessing: boolean;
};

function detectGrade(grade: string): { type: ProblemType; scale: string; from: string; to: string; isRange: boolean } {
    const isRange = grade.includes('-');
    const from = (isRange ? grade.split('-')[0] : grade) ?? '';
    const to = (isRange ? grade.split('-')[1] : '') ?? '';

    const detected = detectGradeScale(from);
    return { type: detected?.type ?? 'boulder', scale: detected?.scale ?? 'V-Scale', from, to, isRange };
}

const inputClass = "w-full bg-surface border border-border rounded-[10px] px-3 py-2.5 text-text-secondary text-sm outline-none box-border"
const labelClass = "text-[11px] text-text-muted tracking-[0.1em] uppercase mb-1.5"
const segmentBtnClass = (active: boolean) =>
    `flex-1 py-[7px] text-xs font-sans border-0 rounded-lg cursor-pointer transition-all ${active ? 'bg-accent/15 text-accent font-bold' : 'bg-transparent text-text-muted font-normal'}`

// Shared grade-picker + problem-field form for editing a problem, used by
// both ProblemDetailPage's inline edit block and (previously) the map's
// ProblemDetails modal. No photos and no location here anymore -- those
// moved to the boulder (a problem has no image_urls/lat/lng of its own,
// see handoff.md decisions 2/4); manage a rock's photos from its own page
// (/boulders/:id) instead.
export default function ProblemEditForm({ form, onChange, onSave, onCancel, isProcessing }: ProblemEditFormProps) {
    const [detected] = useState(() => detectGrade(form.grade));
    const [problemType, setProblemType] = useState<ProblemType>(detected.type);
    const [gradeScale, setGradeScale] = useState<string>(detected.scale);
    const [isRange, setIsRange] = useState(detected.isRange);
    const [gradeFrom, setGradeFrom] = useState(detected.from);
    const [gradeTo, setGradeTo] = useState(detected.to);

    const currentScales = GRADE_SCALES[problemType] as Record<string, readonly string[]>;
    const grades: readonly string[] = currentScales[gradeScale] || [];

    useEffect(() => {
        if (!gradeFrom) return;
        onChange({ ...form, grade: isRange && gradeTo ? `${gradeFrom}-${gradeTo}` : gradeFrom });
        // form/onChange intentionally excluded: only re-run when the picker's own selection changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gradeFrom, gradeTo, isRange]);

    const handleGradePick = (g: string) => {
        if (!isRange) {
            setGradeFrom(g);
            setGradeTo('');
            return;
        }
        if (!gradeFrom || (gradeFrom && gradeTo)) {
            setGradeFrom(g);
            setGradeTo('');
        } else {
            const fromIdx = grades.indexOf(gradeFrom);
            const toIdx = grades.indexOf(g);
            if (toIdx > fromIdx) setGradeTo(g);
            else { setGradeFrom(g); setGradeTo(''); }
        }
    };

    return (
        <div className="mt-4 flex flex-col gap-3">
            {/* Name */}
            <div>
                <div className={labelClass}>Problem Name</div>
                <input
                    value={form.name}
                    onChange={e => onChange({ ...form, name: e.target.value })}
                    placeholder="e.g. Slab Mantap"
                    className={inputClass}
                />
            </div>

            {/* Grade */}
            <div>
                <div className={labelClass}>Grade</div>

                <div className="flex gap-1 bg-surface border border-border rounded-[10px] p-1 mb-2.5">
                    {(['boulder', 'rope'] as ProblemType[]).map(t => (
                        <button key={t} onClick={() => { setProblemType(t); setGradeFrom(''); setGradeTo(''); }} className={segmentBtnClass(problemType === t)}>
                            {t === 'boulder' ? 'Boulder' : 'Rope'}
                        </button>
                    ))}
                </div>

                <div className="flex gap-1 bg-surface border border-border rounded-[10px] p-1 mb-2.5">
                    {Object.keys(GRADE_SCALES[problemType]).map(scale => (
                        <button key={scale} onClick={() => { setGradeScale(scale); setGradeFrom(''); setGradeTo(''); }} className={segmentBtnClass(gradeScale === scale)}>
                            {scale}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs text-text-muted">
                        {isRange
                            ? gradeFrom && gradeTo ? `Range: ${gradeFrom} – ${gradeTo}` : gradeFrom ? `From ${gradeFrom}, pick upper…` : 'Pick lower grade first'
                            : gradeFrom ? `Selected: ${gradeFrom}` : 'Pick a grade'}
                    </span>
                    <button onClick={() => { setIsRange(r => !r); setGradeFrom(''); setGradeTo(''); }}
                        className={`text-[11px] px-2.5 py-1 rounded-full cursor-pointer font-sans transition-all border ${isRange ? 'bg-accent/15 border-accent text-accent' : 'bg-transparent border-border text-text-muted'}`}>
                        Range
                    </button>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                    {grades.map(g => {
                        const isFrom = g === gradeFrom;
                        const isTo = g === gradeTo;
                        const inRange = isRange && gradeFrom && gradeTo
                            ? grades.indexOf(g) > grades.indexOf(gradeFrom) && grades.indexOf(g) < grades.indexOf(gradeTo)
                            : false;
                        const active = isFrom || isTo || inRange;

                        return (
                            <button key={g} onClick={() => handleGradePick(g)} className={`py-1.5 px-3 rounded-full text-xs font-sans cursor-pointer transition-all border ${active ? 'border-accent text-accent' : 'border-border text-text-muted'} ${isFrom || isTo ? 'bg-accent/20' : inRange ? 'bg-accent/[0.08]' : 'bg-transparent'}`}>{g}</button>
                        );
                    })}
                </div>
            </div>

            <div>
                <div className={labelClass}>First ascent by</div>
                <input value={form.first_ascensionist} onChange={e => onChange({ ...form, first_ascensionist: e.target.value })} placeholder="Comma-separate multiple names" className={inputClass} />
            </div>
            <div>
                <div className={labelClass}>Discovered by</div>
                <input value={form.discovered_by} onChange={e => onChange({ ...form, discovered_by: e.target.value })} placeholder="If different from first ascent" className={inputClass} />
            </div>
            <div>
                <div className={labelClass}>Landing / spotting</div>
                <input value={form.landing_hazards} onChange={e => onChange({ ...form, landing_hazards: e.target.value })} placeholder="Pad placement, exposed landing..." className={inputClass} />
            </div>
            <div>
                <div className={labelClass}>How to get down</div>
                <input value={form.descent} onChange={e => onChange({ ...form, descent: e.target.value })} placeholder="Descent notes" className={inputClass} />
            </div>
            <div>
                <div className={labelClass}>Height (m)</div>
                <input type="number" value={form.height_m} onChange={e => onChange({ ...form, height_m: e.target.value })} placeholder="e.g. 4.5" className={inputClass} />
            </div>
            <div>
                <div className={labelClass}>Anything else</div>
                <textarea value={form.notes} onChange={e => onChange({ ...form, notes: e.target.value })} rows={2} className={inputClass} />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button onClick={onSave} disabled={isProcessing} className="flex-1 p-2 bg-accent/10 border border-accent/25 text-accent rounded-lg cursor-pointer text-xs">
                    {isProcessing ? 'Saving...' : 'Save'}
                </button>
                <button onClick={onCancel} className="flex-1 p-2 bg-white/5 border border-border text-text-muted rounded-lg cursor-pointer text-xs">
                    Cancel
                </button>
            </div>
        </div>
    );
}
