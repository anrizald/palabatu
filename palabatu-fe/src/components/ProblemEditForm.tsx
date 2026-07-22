import { useEffect, useState } from 'react';
import { GRADE_SCALES, type ProblemType } from '../lib/constants.js';

type ProblemEditFormProps = {
    initialGrade: string;
    name: string;
    onNameChange: (v: string) => void;
    locationName: string;
    onLocationNameChange: (v: string) => void;
    lat: number;
    lng: number;
    onPickLocation: () => void;
    onGradeChange: (grade: string) => void;
    onSave: () => void;
    onCancel: () => void;
    isProcessing: boolean;
};

function detectGrade(grade: string): { type: ProblemType; scale: string; from: string; to: string; isRange: boolean } {
    const isRange = grade.includes('-');
    const from = (isRange ? grade.split('-')[0] : grade) ?? '';
    const to = (isRange ? grade.split('-')[1] : '') ?? '';

    for (const [ptype, scales] of Object.entries(GRADE_SCALES)) {
        for (const [scaleName, gradesArray] of Object.entries(scales as Record<string, readonly string[]>)) {
            if (gradesArray.includes(from)) {
                return { type: ptype as ProblemType, scale: scaleName, from, to, isRange };
            }
        }
    }
    return { type: 'boulder', scale: 'V-Scale', from, to, isRange };
}

const inputClass = "w-full bg-surface border border-border rounded-[10px] px-3 py-2.5 text-text-secondary text-sm outline-none box-border"
const labelClass = "text-[11px] text-text-dim tracking-[0.1em] uppercase mb-1.5"
const segmentBtnClass = (active: boolean) =>
    `flex-1 py-[7px] text-xs font-sans border-0 rounded-lg cursor-pointer transition-all ${active ? 'bg-accent/15 text-accent font-bold' : 'bg-transparent text-text-dim font-normal'}`

// Shared grade-picker + name/location/coords fields for editing a problem.
// Used by both the map's ProblemDetails modal and the /problems/:id detail
// page's inline edit block.
export default function ProblemEditForm({
    initialGrade, name, onNameChange, locationName, onLocationNameChange,
    lat, lng, onPickLocation, onGradeChange, onSave, onCancel, isProcessing,
}: ProblemEditFormProps) {
    const [detected] = useState(() => detectGrade(initialGrade));
    const [problemType, setProblemType] = useState<ProblemType>(detected.type);
    const [gradeScale, setGradeScale] = useState<string>(detected.scale);
    const [isRange, setIsRange] = useState(detected.isRange);
    const [gradeFrom, setGradeFrom] = useState(detected.from);
    const [gradeTo, setGradeTo] = useState(detected.to);

    const currentScales = GRADE_SCALES[problemType] as Record<string, readonly string[]>;
    const grades: readonly string[] = currentScales[gradeScale] || [];

    useEffect(() => {
        if (!gradeFrom) return;
        onGradeChange(isRange && gradeTo ? `${gradeFrom}-${gradeTo}` : gradeFrom);
        // onGradeChange intentionally excluded: only re-run when the picker's own selection changes.
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
                    value={name}
                    onChange={e => onNameChange(e.target.value)}
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
                    <span className="text-xs text-text-dim">
                        {isRange
                            ? gradeFrom && gradeTo ? `Range: ${gradeFrom} – ${gradeTo}` : gradeFrom ? `From ${gradeFrom}, pick upper…` : 'Pick lower grade first'
                            : gradeFrom ? `Selected: ${gradeFrom}` : 'Pick a grade'}
                    </span>
                    <button onClick={() => { setIsRange(r => !r); setGradeFrom(''); setGradeTo(''); }}
                        className={`text-[11px] px-2.5 py-1 rounded-full cursor-pointer font-sans transition-all border ${isRange ? 'bg-accent/15 border-accent text-accent' : 'bg-transparent border-border text-text-dim'}`}>
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
                            <button key={g} onClick={() => handleGradePick(g)} className={`py-1.5 px-3 rounded-full text-xs font-sans cursor-pointer transition-all border ${active ? 'border-accent text-accent' : 'border-border text-text-dim'} ${isFrom || isTo ? 'bg-accent/20' : inRange ? 'bg-accent/[0.08]' : 'bg-transparent'}`}>{g}</button>
                        );
                    })}
                </div>
            </div>

            {/* Location */}
            <div>
                <div className={labelClass}>Location Name</div>
                <input
                    value={locationName}
                    onChange={e => onLocationNameChange(e.target.value)}
                    placeholder="e.g. Parang, Jawa Barat"
                    className={inputClass}
                />
            </div>

            {/* Pinpoint */}
            <div>
                <div className={labelClass}>Location on Map</div>
                <div className="flex gap-2 items-center">
                    <div className="flex-1 px-3.5 py-2.5 bg-associate/10 border border-associate rounded-[10px] text-associate text-[13px]">
                        {lat?.toFixed(4)}, {lng?.toFixed(4)}
                    </div>
                    <button
                        type="button"
                        onClick={onPickLocation}
                        className="px-3.5 py-2.5 bg-accent/10 border border-accent/25 text-accent rounded-[10px] cursor-pointer text-xs whitespace-nowrap"
                    >
                        Change
                    </button>
                </div>
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
